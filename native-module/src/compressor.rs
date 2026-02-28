// System audio DSP: Compressor + RMS Normalizer + Noise Gate
//
// Designed for phone-codec speech captured via CoreAudio tap.
// Replaces the peak-envelope AGC which couldn't address:
//   - Low average volume (mean -31.9 dB, Parakeet expects ~-16 dB)
//   - High crest factor (24.4 — peaks 24x above average)
//
// Pipeline: SpeechCompressor → RmsNormalizer → NoiseGate
// All sample-by-sample or per-batch. Zero added latency.

// ============================================================================
// SpeechCompressor — RMS-sidechain, reduces crest factor from ~24 to ~6-8
// ============================================================================

/// 10ms RMS window at 48kHz
const RMS_WINDOW: usize = 480;
/// Threshold in linear (~-20 dBFS)
const COMP_THRESHOLD: f32 = 0.1;
/// 4:1 compression ratio
const COMP_RATIO: f32 = 4.0;
/// Soft knee width in dB
const KNEE_DB: f32 = 6.0;
/// Attack coefficient: ~1ms at 48kHz (per-sample smoothing)
/// alpha = 1 - exp(-1 / (sample_rate * time_s)) ≈ 1 - exp(-1/48) ≈ 0.021
const ATTACK_COEFF: f32 = 0.02;
/// Release coefficient: ~50ms at 48kHz
/// alpha = 1 - exp(-1 / (48000 * 0.05)) ≈ 0.00042
const RELEASE_COEFF: f32 = 0.00042;

pub struct SpeechCompressor {
    /// Circular buffer for RMS computation
    rms_buffer: [f32; RMS_WINDOW],
    rms_index: usize,
    rms_sum: f32,
    /// Smoothed gain envelope
    gain_smooth: f32,
}

impl SpeechCompressor {
    pub fn new() -> Self {
        Self {
            rms_buffer: [0.0; RMS_WINDOW],
            rms_index: 0,
            rms_sum: 0.0,
            gain_smooth: 1.0,
        }
    }

    /// Compute gain reduction in dB for a given input level in dB,
    /// with soft-knee transition around threshold.
    fn compute_gain_db(input_db: f32) -> f32 {
        let thresh_db = 20.0 * COMP_THRESHOLD.log10(); // ~-20 dB
        let half_knee = KNEE_DB / 2.0;

        if input_db < thresh_db - half_knee {
            // Below knee: no compression
            0.0
        } else if input_db > thresh_db + half_knee {
            // Above knee: full ratio compression
            (thresh_db + (input_db - thresh_db) / COMP_RATIO) - input_db
        } else {
            // In knee: quadratic interpolation
            let x = input_db - thresh_db + half_knee;
            let gain_reduction = (1.0 / COMP_RATIO - 1.0) * x * x / (2.0 * KNEE_DB);
            gain_reduction
        }
    }

    pub fn process(&mut self, samples: &mut [f32]) {
        for sample in samples.iter_mut() {
            let input = *sample;
            let sq = input * input;

            // Update sliding RMS window
            self.rms_sum -= self.rms_buffer[self.rms_index];
            self.rms_buffer[self.rms_index] = sq;
            self.rms_sum += sq;
            self.rms_index = (self.rms_index + 1) % RMS_WINDOW;

            // Compute RMS level
            let rms = (self.rms_sum / RMS_WINDOW as f32).sqrt().max(1e-10);
            let input_db = 20.0 * rms.log10();

            // Desired gain in dB from compressor curve
            let gain_db = Self::compute_gain_db(input_db);
            let desired_gain = 10.0f32.powf(gain_db / 20.0);

            // Smooth gain with attack/release
            let coeff = if desired_gain < self.gain_smooth {
                ATTACK_COEFF // fast attack for transients
            } else {
                RELEASE_COEFF // slow release for smooth recovery
            };
            self.gain_smooth += coeff * (desired_gain - self.gain_smooth);

            *sample = input * self.gain_smooth;
        }
    }
}

// ============================================================================
// RmsNormalizer — brings post-compression signal to -16 dBFS target
// ============================================================================

/// Target RMS: -16 dBFS ≈ 0.15 linear
const TARGET_RMS: f32 = 0.15;
/// Maximum gain to prevent noise blowup
const NORM_MAX_GAIN: f32 = 40.0;
/// Minimum gain (slight attenuation allowed)
const NORM_MIN_GAIN: f32 = 0.5;
/// Smoothing coefficient: ~200ms time constant at per-sample rate
/// alpha ≈ 1 / (48000 * 0.2) ≈ 0.000104
const NORM_SMOOTH_COEFF: f32 = 0.0001;
/// RMS floor — below this, hold gain (don't track silence)
const NORM_SILENCE_FLOOR: f32 = 0.001;

pub struct RmsNormalizer {
    rms_buffer: [f32; RMS_WINDOW],
    rms_index: usize,
    rms_sum: f32,
    current_gain: f32,
}

impl RmsNormalizer {
    pub fn new() -> Self {
        Self {
            rms_buffer: [0.0; RMS_WINDOW],
            rms_index: 0,
            rms_sum: 0.0,
            current_gain: 1.0,
        }
    }

    pub fn process(&mut self, samples: &mut [f32]) {
        for sample in samples.iter_mut() {
            let sq = *sample * *sample;

            // Update sliding RMS
            self.rms_sum -= self.rms_buffer[self.rms_index];
            self.rms_buffer[self.rms_index] = sq;
            self.rms_sum += sq;
            self.rms_index = (self.rms_index + 1) % RMS_WINDOW;

            let rms = (self.rms_sum / RMS_WINDOW as f32).sqrt();

            // Only adapt gain when signal is above silence floor
            if rms > NORM_SILENCE_FLOOR {
                let desired_gain = (TARGET_RMS / rms).clamp(NORM_MIN_GAIN, NORM_MAX_GAIN);
                self.current_gain += NORM_SMOOTH_COEFF * (desired_gain - self.current_gain);
                self.current_gain = self.current_gain.clamp(NORM_MIN_GAIN, NORM_MAX_GAIN);
            }

            // Apply gain with hard clip
            *sample = (*sample * self.current_gain).clamp(-1.0, 1.0);
        }
    }
}

// ============================================================================
// NoiseGate — zeros out amplified noise during silence
// ============================================================================

/// Open threshold: -46 dBFS RMS ≈ 0.005 linear
const GATE_OPEN_THRESH: f32 = 0.005;
/// Close threshold: -50 dBFS RMS ≈ 0.00316 (hysteresis)
const GATE_CLOSE_THRESH: f32 = 0.00316;
/// Hold time in samples: 50ms at 48kHz
const GATE_HOLD_SAMPLES: usize = 2400;
/// Release fade in samples: 10ms at 48kHz
const GATE_RELEASE_SAMPLES: usize = 480;

#[derive(Clone, Copy, Debug, PartialEq)]
enum GateState {
    Open,
    Hold,
    Release,
    Closed,
}

pub struct NoiseGate {
    rms_buffer: [f32; RMS_WINDOW],
    rms_index: usize,
    rms_sum: f32,
    state: GateState,
    hold_counter: usize,
    release_counter: usize,
}

impl NoiseGate {
    pub fn new() -> Self {
        Self {
            rms_buffer: [0.0; RMS_WINDOW],
            rms_index: 0,
            rms_sum: 0.0,
            state: GateState::Open, // start open so we don't gate initial speech
            hold_counter: 0,
            release_counter: 0,
        }
    }

    pub fn process(&mut self, samples: &mut [f32]) {
        for sample in samples.iter_mut() {
            let sq = *sample * *sample;

            // Update sliding RMS
            self.rms_sum -= self.rms_buffer[self.rms_index];
            self.rms_buffer[self.rms_index] = sq;
            self.rms_sum += sq;
            self.rms_index = (self.rms_index + 1) % RMS_WINDOW;

            let rms = (self.rms_sum / RMS_WINDOW as f32).sqrt();

            match self.state {
                GateState::Closed => {
                    if rms >= GATE_OPEN_THRESH {
                        // Instant open — no speech onset delay
                        self.state = GateState::Open;
                    } else {
                        *sample = 0.0;
                    }
                }
                GateState::Open => {
                    if rms < GATE_CLOSE_THRESH {
                        self.state = GateState::Hold;
                        self.hold_counter = GATE_HOLD_SAMPLES;
                    }
                    // Pass through
                }
                GateState::Hold => {
                    if rms >= GATE_OPEN_THRESH {
                        self.state = GateState::Open;
                    } else if self.hold_counter > 0 {
                        self.hold_counter -= 1;
                    } else {
                        self.state = GateState::Release;
                        self.release_counter = GATE_RELEASE_SAMPLES;
                    }
                    // Pass through during hold
                }
                GateState::Release => {
                    if rms >= GATE_OPEN_THRESH {
                        self.state = GateState::Open;
                    } else if self.release_counter > 0 {
                        // Linear fade to zero
                        let fade = self.release_counter as f32 / GATE_RELEASE_SAMPLES as f32;
                        *sample *= fade;
                        self.release_counter -= 1;
                    } else {
                        self.state = GateState::Closed;
                        *sample = 0.0;
                    }
                }
            }
        }
    }
}

// ============================================================================
// SystemAudioProcessor — combines all three into one `process(&mut [f32])`
// ============================================================================

pub struct SystemAudioProcessor {
    compressor: SpeechCompressor,
    normalizer: RmsNormalizer,
    gate: NoiseGate,
}

impl SystemAudioProcessor {
    pub fn new() -> Self {
        Self {
            compressor: SpeechCompressor::new(),
            normalizer: RmsNormalizer::new(),
            gate: NoiseGate::new(),
        }
    }

    /// Process audio in-place: compress → normalize → gate.
    /// Same API as the old `AutoGainControl::process`.
    pub fn process(&mut self, samples: &mut [f32]) {
        self.compressor.process(samples);
        self.normalizer.process(samples);
        self.gate.process(samples);
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn make_sine(freq: f32, amplitude: f32, sample_rate: f32, num_samples: usize) -> Vec<f32> {
        (0..num_samples)
            .map(|i| amplitude * (2.0 * std::f32::consts::PI * freq * i as f32 / sample_rate).sin())
            .collect()
    }

    fn rms(samples: &[f32]) -> f32 {
        (samples.iter().map(|s| s * s).sum::<f32>() / samples.len() as f32).sqrt()
    }

    fn crest_factor(samples: &[f32]) -> f32 {
        let peak = samples.iter().map(|s| s.abs()).fold(0.0f32, f32::max);
        let r = rms(samples);
        if r > 0.0 { peak / r } else { 0.0 }
    }

    // --- SpeechCompressor tests ---

    #[test]
    fn test_compressor_attenuates_loud_signal() {
        let mut comp = SpeechCompressor::new();

        // Warm up with moderate signal to prime RMS window
        let mut warmup = make_sine(440.0, 0.15, 48000.0, 4800);
        comp.process(&mut warmup);

        // Feed loud signal above threshold (-20 dBFS = 0.1 linear)
        // Amplitude 0.3 is well above threshold, should be compressed
        let mut loud = make_sine(440.0, 0.3, 48000.0, 4800);
        let rms_before = rms(&loud);
        comp.process(&mut loud);
        let rms_after = rms(&loud);

        // Compressor should reduce the level of loud signal (gain < 1.0)
        assert!(rms_after < rms_before,
            "Compressor should attenuate signal above threshold: before={:.4}, after={:.4}",
            rms_before, rms_after);
    }

    #[test]
    fn test_compressor_quiet_signal_passes_through() {
        let mut comp = SpeechCompressor::new();
        // Below threshold signal should pass mostly unchanged
        let mut signal = make_sine(440.0, 0.01, 48000.0, 4800);
        let rms_before = rms(&signal);
        comp.process(&mut signal);
        let rms_after = rms(&signal);
        // Gain should be ~1.0 (no compression below threshold)
        assert!((rms_after / rms_before - 1.0).abs() < 0.3,
            "Quiet signal shouldn't be heavily modified: ratio={:.2}", rms_after / rms_before);
    }

    #[test]
    fn test_compressor_soft_knee() {
        // Verify soft knee provides smooth transition
        let gain_below = SpeechCompressor::compute_gain_db(-30.0);
        let gain_at_thresh = SpeechCompressor::compute_gain_db(-20.0);
        let gain_above = SpeechCompressor::compute_gain_db(-10.0);

        assert!(gain_below.abs() < 0.01, "No compression below knee: {}", gain_below);
        assert!(gain_above < -1.0, "Should compress above knee: {}", gain_above);
        // At threshold (middle of knee), should have some but not full compression
        assert!(gain_at_thresh <= 0.0, "Should have some compression at threshold: {}", gain_at_thresh);
    }

    // --- RmsNormalizer tests ---

    #[test]
    fn test_normalizer_amplifies_quiet_signal() {
        let mut norm = RmsNormalizer::new();
        // Feed quiet signal for a few seconds to let it converge
        for _ in 0..200 {
            let mut frame = make_sine(440.0, 0.005, 48000.0, 480);
            norm.process(&mut frame);
        }
        // After convergence, check output level
        let mut frame = make_sine(440.0, 0.005, 48000.0, 480);
        norm.process(&mut frame);
        let out_rms = rms(&frame);
        assert!(out_rms > 0.05, "Normalizer should amplify quiet signal: rms={:.4}", out_rms);
    }

    #[test]
    fn test_normalizer_output_clipped() {
        let mut norm = RmsNormalizer::new();
        // Even with max gain, output should never exceed ±1.0
        for _ in 0..100 {
            let mut frame = make_sine(440.0, 0.1, 48000.0, 480);
            norm.process(&mut frame);
            for &s in &frame {
                assert!(s.abs() <= 1.0, "Output must be in [-1,1], got {}", s);
            }
        }
    }

    #[test]
    fn test_normalizer_holds_during_silence() {
        let mut norm = RmsNormalizer::new();
        // Feed signal to set gain
        for _ in 0..100 {
            let mut frame = make_sine(440.0, 0.01, 48000.0, 480);
            norm.process(&mut frame);
        }
        let gain_before = norm.current_gain;
        // Feed silence
        let mut silence = vec![0.0f32; 480];
        norm.process(&mut silence);
        let gain_after = norm.current_gain;
        assert!((gain_before - gain_after).abs() < 0.5,
            "Gain should hold during silence: before={:.2}, after={:.2}", gain_before, gain_after);
    }

    // --- NoiseGate tests ---

    #[test]
    fn test_gate_zeros_silence() {
        let mut gate = NoiseGate::new();
        // Feed enough low-level noise to fill RMS window and let gate close
        let mut noise: Vec<f32> = (0..48000).map(|_| 0.0001).collect();
        gate.process(&mut noise);
        // Last portion should be gated (zeroed)
        let tail_rms = rms(&noise[40000..]);
        assert!(tail_rms < 0.0001, "Gate should zero out very quiet signal: rms={:.6}", tail_rms);
    }

    #[test]
    fn test_gate_passes_speech() {
        let mut gate = NoiseGate::new();
        let mut signal = make_sine(440.0, 0.1, 48000.0, 4800);
        let rms_before = rms(&signal);
        gate.process(&mut signal);
        let rms_after = rms(&signal);
        // Speech-level signal should pass through
        assert!(rms_after > rms_before * 0.8,
            "Gate should pass speech: before={:.4}, after={:.4}", rms_before, rms_after);
    }

    #[test]
    fn test_gate_hysteresis() {
        let mut gate = NoiseGate::new();
        // Start with speech to open gate
        let mut speech = make_sine(440.0, 0.1, 48000.0, 4800);
        gate.process(&mut speech);
        assert_eq!(gate.state, GateState::Open);

        // Drop well below close threshold (0.00316) to trigger hold→release→closed
        // Use enough samples for hold (2400) + release (480) to fully elapse
        let mut quiet: Vec<f32> = vec![0.001; 4800];
        gate.process(&mut quiet);
        assert_ne!(gate.state, GateState::Open,
            "Hysteresis: gate should close after signal drops below close threshold");
    }

    // --- SystemAudioProcessor integration tests ---

    #[test]
    fn test_processor_quiet_phone_audio_amplified() {
        let mut proc = SystemAudioProcessor::new();

        // Simulate phone-codec speech: quiet (RMS ~0.003) with occasional peaks
        // Run for ~2 seconds to let all stages converge
        for _ in 0..200 {
            let mut frame = make_sine(440.0, 0.003, 48000.0, 480);
            proc.process(&mut frame);
        }

        // Now check output level
        let mut frame = make_sine(440.0, 0.003, 48000.0, 480);
        let rms_before = rms(&frame);
        proc.process(&mut frame);
        let rms_after = rms(&frame);

        assert!(rms_after > rms_before * 5.0,
            "Processor should significantly amplify quiet phone audio: before={:.4}, after={:.4}",
            rms_before, rms_after);
    }

    #[test]
    fn test_processor_output_bounded() {
        let mut proc = SystemAudioProcessor::new();
        for _ in 0..100 {
            let mut frame = make_sine(440.0, 0.5, 48000.0, 480);
            proc.process(&mut frame);
            for &s in &frame {
                assert!(s.abs() <= 1.0, "Output must be in [-1,1], got {}", s);
            }
        }
    }

    #[test]
    fn test_processor_silence_is_quiet() {
        let mut proc = SystemAudioProcessor::new();
        // Feed enough silence for gate to close
        for _ in 0..500 {
            let mut frame = vec![0.0001f32; 480];
            proc.process(&mut frame);
        }
        let mut silence = vec![0.0001f32; 480];
        proc.process(&mut silence);
        let out_rms = rms(&silence);
        assert!(out_rms < 0.01,
            "Silence should remain quiet after processing: rms={:.6}", out_rms);
    }
}
