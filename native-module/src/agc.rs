// Automatic Gain Control for system audio
//
// CoreAudioTap captures at the macOS playback level, which is often
// 50–100x quieter than microphone input. The raw signal is also bursty:
// quiet most of the time (RMS 0.001–0.005) with occasional loud bursts
// (RMS 0.05–0.30).
//
// Design: peak-envelope follower with asymmetric dynamics.
//   - Instant attack: gain drops immediately when a loud sample arrives,
//     so speech onsets are never clipped.
//   - Slow release (~500 ms): gain rises slowly after the loud signal
//     ends, preventing pumping on short pauses.
//   - Gain is computed from the peak envelope, not RMS, for faster
//     transient response on bursty VoIP audio.

/// Target peak level for normalised output.
/// 0.25 keeps headroom for the i16 conversion while being loud enough for STT.
const TARGET_PEAK: f32 = 0.25;

/// Maximum gain. Caps amplification of noise/silence.
const MAX_GAIN: f32 = 60.0;

/// Minimum gain (unity — never attenuate).
const MIN_GAIN: f32 = 1.0;

/// Peak envelope release coefficient (per-sample).
/// Controls how fast the envelope decays after a peak.
/// At 48 kHz, 0.9999 gives ~200 ms half-life; 0.99995 gives ~1 s.
/// We use 0.99993 for ~300 ms effective hold.
const ENVELOPE_RELEASE: f32 = 0.99993;

/// Gain release coefficient (per-batch, ~10 ms batches).
/// How fast gain INCREASES after signal gets quieter.
/// 0.02 gives ~500 ms time constant — slow rise prevents pumping.
const GAIN_RELEASE_COEFF: f32 = 0.02;

/// Minimum peak envelope to act on. Below this, hold gain (silence).
const SILENCE_FLOOR: f32 = 0.0001;

pub struct AutoGainControl {
    current_gain: f32,
    peak_envelope: f32,
}

impl AutoGainControl {
    pub fn new() -> Self {
        Self {
            current_gain: MAX_GAIN, // start high so first speech is audible
            peak_envelope: 0.0,
        }
    }

    /// Apply AGC to a batch of f32 samples **in-place**.
    /// Call this on raw CoreAudioTap samples before resampling.
    pub fn process(&mut self, samples: &mut [f32]) {
        if samples.is_empty() {
            return;
        }

        // 1. Update peak envelope from this batch
        for &s in samples.iter() {
            let abs = s.abs();
            if abs > self.peak_envelope {
                // Instant attack: envelope jumps to peak immediately
                self.peak_envelope = abs;
            } else {
                // Slow release: envelope decays toward zero
                self.peak_envelope *= ENVELOPE_RELEASE;
            }
        }

        // 2. Compute desired gain from peak envelope
        if self.peak_envelope > SILENCE_FLOOR {
            let desired_gain = (TARGET_PEAK / self.peak_envelope).clamp(MIN_GAIN, MAX_GAIN);

            if desired_gain < self.current_gain {
                // Instant attack: gain drops immediately when signal is loud.
                // This prevents clipping at the start of speech bursts.
                self.current_gain = desired_gain;
            } else {
                // Slow release: gain rises slowly after signal gets quieter.
                // Prevents pumping between words/pauses.
                self.current_gain += GAIN_RELEASE_COEFF * (desired_gain - self.current_gain);
                self.current_gain = self.current_gain.clamp(MIN_GAIN, MAX_GAIN);
            }
        }
        // If below silence floor: hold current gain (don't adapt).

        // 3. Apply gain with hard clip (soft clip was distorting speech)
        let gain = self.current_gain;
        for sample in samples.iter_mut() {
            *sample = (*sample * gain).clamp(-1.0, 1.0);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_quiet_signal_is_amplified() {
        let mut agc = AutoGainControl::new();
        // Simulate quiet system audio (RMS ~0.001)
        let mut frame: Vec<f32> = (0..320).map(|i| {
            0.001 * (2.0 * std::f32::consts::PI * 440.0 * i as f32 / 16000.0).sin()
        }).collect();

        agc.process(&mut frame);

        let rms_out: f32 = (frame.iter().map(|s| s * s).sum::<f32>() / frame.len() as f32).sqrt();
        assert!(rms_out > 0.01, "AGC should amplify quiet signal, got rms={}", rms_out);
    }

    #[test]
    fn test_loud_burst_not_clipped_after_quiet() {
        let mut agc = AutoGainControl::new();

        // Feed quiet signal to ramp gain up
        for _ in 0..50 {
            let mut quiet: Vec<f32> = (0..480).map(|i| {
                0.002 * (2.0 * std::f32::consts::PI * 440.0 * i as f32 / 48000.0).sin()
            }).collect();
            agc.process(&mut quiet);
        }

        // Now a loud burst arrives (RMS ~0.15, peak ~0.21)
        let mut burst: Vec<f32> = (0..480).map(|i| {
            0.15 * (2.0 * std::f32::consts::PI * 440.0 * i as f32 / 48000.0).sin()
        }).collect();
        agc.process(&mut burst);

        // Peak should be reasonable (not all clipped to ±1.0)
        let peak = burst.iter().map(|s| s.abs()).fold(0.0f32, f32::max);
        // With instant attack, gain should drop before clipping the whole frame
        // Some initial samples may clip, but most of the frame should be clean
        let clipped_count = burst.iter().filter(|&&s| s.abs() > 0.99).count();
        assert!(clipped_count < burst.len() / 4,
            "Too many clipped samples: {}/{}, peak={}", clipped_count, burst.len(), peak);
    }

    #[test]
    fn test_steady_signal_converges() {
        let mut agc = AutoGainControl::new();

        // Feed steady signal for 2 seconds worth of batches
        let mut last_rms = 0.0f32;
        for _ in 0..200 {
            let mut frame: Vec<f32> = (0..480).map(|i| {
                0.005 * (2.0 * std::f32::consts::PI * 440.0 * i as f32 / 48000.0).sin()
            }).collect();
            agc.process(&mut frame);
            last_rms = (frame.iter().map(|s| s * s).sum::<f32>() / frame.len() as f32).sqrt();
        }

        // Output should be near target level
        // target_peak=0.25, so RMS of sine ≈ 0.25/√2 ≈ 0.177
        assert!(last_rms > 0.05, "Should converge to reasonable level, got rms={}", last_rms);
        assert!(last_rms < 0.50, "Should not overshoot, got rms={}", last_rms);
    }

    #[test]
    fn test_silence_preserves_gain() {
        let mut agc = AutoGainControl::new();

        // Feed real signal to set gain
        for _ in 0..50 {
            let mut signal: Vec<f32> = (0..480).map(|i| {
                0.003 * (2.0 * std::f32::consts::PI * 440.0 * i as f32 / 48000.0).sin()
            }).collect();
            agc.process(&mut signal);
        }
        let gain_before = agc.current_gain;

        // Feed silence
        let mut silence = vec![0.0f32; 480];
        agc.process(&mut silence);
        let gain_after = agc.current_gain;

        assert!((gain_before - gain_after).abs() < 1.0,
            "Gain should hold during silence: before={}, after={}", gain_before, gain_after);
    }

    #[test]
    fn test_output_never_exceeds_one() {
        let mut agc = AutoGainControl::new();
        // Very loud burst after quiet period (gain is at max)
        let mut frame: Vec<f32> = (0..480).map(|i| {
            0.5 * (2.0 * std::f32::consts::PI * 440.0 * i as f32 / 48000.0).sin()
        }).collect();

        agc.process(&mut frame);

        for &s in &frame {
            assert!(s.abs() <= 1.0, "output should be in [-1,1], got {}", s);
        }
    }
}
