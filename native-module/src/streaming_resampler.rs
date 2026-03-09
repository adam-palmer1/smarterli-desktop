// Streaming Sinc Resampler (rubato-backed)
//
// High-quality anti-aliased downsampling using sinc interpolation.
// Replaces the previous linear interpolation resampler which introduced
// aliasing artifacts that degraded STT accuracy.
//
// Key properties:
// - Anti-aliasing filter rejects frequencies above output Nyquist (~60dB)
// - Supports dynamic sample rate changes (e.g. SCK delivering 24kHz)
// - Returns f32 output (i16 conversion moved to caller for pipeline flexibility)
// - ~0.5ms latency from the FIR filter (negligible for STT)

use rubato::{
    Resampler, SincFixedIn, SincInterpolationParameters,
    SincInterpolationType, WindowFunction,
};

const OUTPUT_RATE: f64 = 16000.0;

/// Sinc interpolation parameters tuned for speech downsampling.
/// sinc_len=64 gives good anti-aliasing with low latency (~1.3ms at 48kHz).
fn sinc_params() -> SincInterpolationParameters {
    SincInterpolationParameters {
        sinc_len: 64,
        f_cutoff: 0.925,
        interpolation: SincInterpolationType::Linear,
        oversampling_factor: 128,
        window: WindowFunction::BlackmanHarris2,
    }
}

pub struct StreamingResampler {
    resampler: SincFixedIn<f32>,
    /// Chunk size the resampler expects (fixed input length)
    chunk_size: usize,
    /// Accumulator for input samples until we have a full chunk
    input_buf: Vec<f32>,
    /// Current input sample rate
    input_rate: f64,
}

impl StreamingResampler {
    pub fn new(input_sample_rate: f64, _output_sample_rate: f64) -> Self {
        let ratio = OUTPUT_RATE / input_sample_rate; // rubato ratio is output/input
        let chunk_size = 480; // 10ms at 48kHz, good balance of latency vs efficiency

        let resampler = SincFixedIn::<f32>::new(
            ratio,
            2.0, // max ratio deviation (supports rate changes)
            sinc_params(),
            chunk_size,
            1, // mono
        )
        .expect("Failed to create sinc resampler");

        println!(
            "[StreamingResampler] Created: {}Hz -> {}Hz (sinc interpolation, chunk={})",
            input_sample_rate, OUTPUT_RATE, chunk_size
        );

        Self {
            resampler,
            chunk_size,
            input_buf: Vec::with_capacity(chunk_size * 2),
            input_rate: input_sample_rate,
        }
    }

    /// Resample a chunk of f32 audio, returning f32 output at 16kHz.
    /// Accumulates input until a full chunk is available, then processes.
    pub fn resample(&mut self, input: &[f32]) -> Vec<f32> {
        if input.is_empty() {
            return Vec::new();
        }

        self.input_buf.extend_from_slice(input);

        let mut output = Vec::new();

        // Process all complete chunks
        while self.input_buf.len() >= self.chunk_size {
            let chunk: Vec<f32> = self.input_buf.drain(..self.chunk_size).collect();
            let input_frames = vec![chunk];

            match self.resampler.process(&input_frames, None) {
                Ok(result) => {
                    if !result.is_empty() {
                        output.extend_from_slice(&result[0]);
                    }
                }
                Err(e) => {
                    println!("[StreamingResampler] Process error: {:?}", e);
                }
            }
        }

        output
    }

    /// Convert f32 samples to i16 PCM
    pub fn f32_to_i16(samples: &[f32]) -> Vec<i16> {
        samples
            .iter()
            .map(|&s| (s * 32767.0).clamp(-32768.0, 32767.0) as i16)
            .collect()
    }

    /// Update the input sample rate dynamically.
    pub fn set_input_sample_rate(&mut self, new_input_rate: f64, _output_rate: f64) {
        if (new_input_rate - self.input_rate).abs() < 1.0 {
            return;
        }

        let new_ratio = OUTPUT_RATE / new_input_rate;
        println!(
            "[StreamingResampler] Rate changed: {}Hz -> {}Hz (new ratio {:.4})",
            self.input_rate, new_input_rate, new_ratio
        );

        if self.resampler.set_resample_ratio(new_ratio, false).is_err() {
            // Ratio too far from original — rebuild the resampler
            println!("[StreamingResampler] Rebuilding resampler for new rate");
            match SincFixedIn::<f32>::new(new_ratio, 2.0, sinc_params(), self.chunk_size, 1) {
                Ok(r) => {
                    self.resampler = r;
                }
                Err(e) => {
                    println!("[StreamingResampler] Rebuild failed: {:?}", e);
                    return;
                }
            }
        }

        self.input_rate = new_input_rate;
    }

    pub fn reset(&mut self) {
        self.input_buf.clear();
        self.resampler.reset();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_downsample_3x() {
        // 48kHz to 16kHz = 3:1 ratio
        let mut resampler = StreamingResampler::new(48000.0, 16000.0);

        // Feed multiple chunks to get past sinc filter priming delay
        let chunk: Vec<f32> = (0..480).map(|i| (i as f32 / 480.0) * 0.5).collect();
        let _out1 = resampler.resample(&chunk); // first chunk has filter delay
        let out2 = resampler.resample(&chunk); // steady state

        // 480 input samples at 48kHz = 10ms -> ~160 output samples at 16kHz
        assert!(
            out2.len() >= 155 && out2.len() <= 165,
            "Expected ~160 samples, got {}",
            out2.len()
        );
    }

    #[test]
    fn test_streaming_continuity() {
        let mut resampler = StreamingResampler::new(48000.0, 16000.0);

        // Process multiple chunks — first has filter priming delay
        let chunk: Vec<f32> = (0..480).map(|_| 0.5).collect();
        let _out1 = resampler.resample(&chunk); // priming
        let out2 = resampler.resample(&chunk); // steady state
        let out3 = resampler.resample(&chunk); // steady state

        assert!(!out2.is_empty());
        assert!(!out3.is_empty());
        // After priming, consecutive chunks should produce consistent output
        assert!(
            (out2.len() as i32 - out3.len() as i32).abs() <= 2,
            "Chunks should produce similar output: {} vs {}",
            out2.len(),
            out3.len()
        );
    }

    #[test]
    fn test_anti_aliasing() {
        // Generate a tone above the output Nyquist (e.g. 12kHz at 48kHz input)
        // After proper resampling to 16kHz, this should be heavily attenuated
        let mut resampler = StreamingResampler::new(48000.0, 16000.0);

        let freq = 12000.0; // above 8kHz Nyquist of 16kHz output
        let input: Vec<f32> = (0..4800)
            .map(|i| (2.0 * std::f32::consts::PI * freq * i as f32 / 48000.0).sin() * 0.5)
            .collect();

        let output = resampler.resample(&input);

        // Output RMS should be very low (anti-aliasing filter rejects 12kHz)
        let rms: f32 =
            (output.iter().map(|s| s * s).sum::<f32>() / output.len().max(1) as f32).sqrt();
        assert!(
            rms < 0.05,
            "12kHz tone should be attenuated by anti-alias filter, RMS={:.4}",
            rms
        );
    }

    #[test]
    fn test_speech_band_preserved() {
        // Generate a 1kHz tone (well within speech band)
        // Should pass through with minimal attenuation
        let mut resampler = StreamingResampler::new(48000.0, 16000.0);

        let freq = 1000.0;
        let amplitude = 0.5;
        let input: Vec<f32> = (0..4800)
            .map(|i| (2.0 * std::f32::consts::PI * freq * i as f32 / 48000.0).sin() * amplitude)
            .collect();

        let output = resampler.resample(&input);

        let rms: f32 =
            (output.iter().map(|s| s * s).sum::<f32>() / output.len().max(1) as f32).sqrt();
        let expected_rms = amplitude / 2.0f32.sqrt(); // sine wave RMS = amplitude / sqrt(2)
        assert!(
            rms > expected_rms * 0.8,
            "1kHz should pass through: RMS={:.4}, expected>{:.4}",
            rms,
            expected_rms * 0.8
        );
    }

    #[test]
    fn test_f32_to_i16_conversion() {
        let samples = vec![0.0f32, 1.0, -1.0, 0.5, -0.5];
        let i16_samples = StreamingResampler::f32_to_i16(&samples);
        assert_eq!(i16_samples[0], 0);
        assert_eq!(i16_samples[1], 32767);
        assert_eq!(i16_samples[2], -32767); // clamped from -32768.0
        assert_eq!(i16_samples[3], 16383); // 0.5 * 32767 ≈ 16383
    }

    #[test]
    fn test_sub_chunk_accumulation() {
        // Feed less than chunk_size, should buffer and not produce output
        let mut resampler = StreamingResampler::new(48000.0, 16000.0);
        let small: Vec<f32> = vec![0.1; 100];
        let out = resampler.resample(&small);
        assert!(out.is_empty(), "Sub-chunk input should be buffered");

        // Feed remaining to complete a chunk
        let rest: Vec<f32> = vec![0.1; 380];
        let out = resampler.resample(&rest);
        assert!(!out.is_empty(), "Full chunk should produce output");
    }
}
