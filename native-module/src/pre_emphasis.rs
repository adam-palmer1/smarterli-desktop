// Pre-emphasis filter for phone-codec speech
//
// 1st-order FIR: y[n] = x[n] - coeff * x[n-1]
//
// Boosts frequencies above ~300 Hz by ~6 dB/octave, compensating for the
// steep spectral tilt of narrowband phone codecs (G.711, AMR-NB). This
// lifts F2/F3 formant energy before the compressor operates, giving it a
// spectrally flatter signal to work with.
//
// Coefficient 0.65 is conservative — enough to flatten the tilt without
// over-boosting codec artifacts near the 3.2 kHz bandwidth edge.
//
// Zero latency, negligible CPU: 1 multiply + 1 subtract per sample.

const PRE_EMPHASIS_COEFF: f32 = 0.65;

pub struct PreEmphasis {
    prev_sample: f32,
}

impl PreEmphasis {
    pub fn new() -> Self {
        Self { prev_sample: 0.0 }
    }

    /// Apply pre-emphasis filter in-place.
    pub fn process(&mut self, samples: &mut [f32]) {
        for sample in samples.iter_mut() {
            let input = *sample;
            *sample = input - PRE_EMPHASIS_COEFF * self.prev_sample;
            self.prev_sample = input;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dc_is_attenuated() {
        let mut filter = PreEmphasis::new();
        // DC signal (constant value) should be attenuated by (1 - coeff)
        let mut samples = vec![1.0f32; 100];
        filter.process(&mut samples);
        // First sample: 1.0 - 0.65*0.0 = 1.0 (no previous)
        // Subsequent: 1.0 - 0.65*1.0 = 0.35
        assert!((samples[0] - 1.0).abs() < 1e-6);
        assert!((samples[50] - 0.35).abs() < 1e-6);
    }

    #[test]
    fn test_high_freq_boosted() {
        let mut filter = PreEmphasis::new();
        // Nyquist alternating signal (+1, -1, +1, -1, ...)
        // Pre-emphasis: y[n] = x[n] - 0.65*x[n-1]
        // For alternating: 1 - 0.65*(-1) = 1.65, -1 - 0.65*1 = -1.65
        let mut samples: Vec<f32> = (0..100).map(|i| if i % 2 == 0 { 1.0 } else { -1.0 }).collect();
        let input_rms: f32 = (samples.iter().map(|s| s * s).sum::<f32>() / samples.len() as f32).sqrt();
        filter.process(&mut samples);
        let output_rms: f32 = (samples.iter().map(|s| s * s).sum::<f32>() / samples.len() as f32).sqrt();
        // High freq should be boosted by factor of ~1.65
        assert!(output_rms > input_rms * 1.5, "HF should be boosted: in={}, out={}", input_rms, output_rms);
    }

    #[test]
    fn test_state_resets_between_calls() {
        let mut filter = PreEmphasis::new();
        let mut a = vec![0.5; 10];
        filter.process(&mut a);
        // State carries over: prev_sample should be 0.5
        let mut b = vec![0.5; 10];
        filter.process(&mut b);
        // b[0] = 0.5 - 0.65*0.5 = 0.175 (uses prev from last batch)
        assert!((b[0] - 0.175).abs() < 1e-6, "State should carry across calls: got {}", b[0]);
    }

    #[test]
    fn test_empty_input() {
        let mut filter = PreEmphasis::new();
        let mut samples: Vec<f32> = vec![];
        filter.process(&mut samples);
        // Should not panic
    }
}
