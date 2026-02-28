use std::collections::VecDeque;
use std::sync::{Arc, Mutex, OnceLock};

use aec_rs::{Aec, AecConfig};

/// Max reference buffer capacity: 1 second at 16kHz
const REF_BUFFER_CAPACITY: usize = 16_000;

/// AEC frame size (10ms sub-frames for best convergence)
const AEC_FRAME_SIZE: usize = 160;

/// Filter length in samples: 200ms echo tail at 16kHz
const AEC_FILTER_LENGTH: usize = 3200;

/// Sample rate for all AEC processing
const AEC_SAMPLE_RATE: u32 = 16_000;

static AEC_REFERENCE: OnceLock<Arc<Mutex<VecDeque<i16>>>> = OnceLock::new();

fn get_ref_buffer() -> &'static Arc<Mutex<VecDeque<i16>>> {
    AEC_REFERENCE.get_or_init(|| Arc::new(Mutex::new(VecDeque::with_capacity(REF_BUFFER_CAPACITY))))
}

/// Push reference audio from the system audio DSP thread.
/// Called after resampling each frame. Trims oldest samples on overflow.
pub fn push_reference(frame: &[i16]) {
    let buf = get_ref_buffer();
    if let Ok(mut guard) = buf.lock() {
        guard.extend(frame.iter().copied());
        while guard.len() > REF_BUFFER_CAPACITY {
            guard.pop_front();
        }
    }
}

/// Pull reference samples for AEC. Returns zeros if buffer has insufficient data.
pub fn pull_reference(size: usize) -> Vec<i16> {
    let buf = get_ref_buffer();
    if let Ok(mut guard) = buf.lock() {
        if guard.len() >= size {
            guard.drain(..size).collect()
        } else {
            // Not enough reference data — return zeros (AEC becomes passthrough)
            vec![0i16; size]
        }
    } else {
        vec![0i16; size]
    }
}

/// Clear the reference buffer. Call when capture starts/stops to prevent stale data.
pub fn clear_reference() {
    let buf = get_ref_buffer();
    if let Ok(mut guard) = buf.lock() {
        guard.clear();
    }
}

pub struct EchoCanceller {
    aec: Aec,
    frame_size: usize,
}

impl EchoCanceller {
    /// Create a new echo canceller. Returns None if initialization fails.
    pub fn new() -> Option<Self> {
        let result = std::panic::catch_unwind(|| {
            let config = AecConfig {
                frame_size: AEC_FRAME_SIZE,
                filter_length: AEC_FILTER_LENGTH as i32,
                sample_rate: AEC_SAMPLE_RATE,
                enable_preprocess: true,
            };
            Aec::new(&config)
        });

        match result {
            Ok(aec) => {
                println!("[EchoCanceller] Initialized (frame={}, filter={}, rate={})",
                    AEC_FRAME_SIZE, AEC_FILTER_LENGTH, AEC_SAMPLE_RATE);
                Some(EchoCanceller {
                    aec,
                    frame_size: AEC_FRAME_SIZE,
                })
            }
            Err(e) => {
                eprintln!("[EchoCanceller] Init failed: {:?}. Falling back to no AEC.", e);
                None
            }
        }
    }

    /// Process a mic frame through AEC. The frame is split into sub-frames
    /// matching the AEC frame size for best convergence.
    pub fn process(&mut self, mic_frame: &[i16]) -> Vec<i16> {
        let ref_samples = pull_reference(mic_frame.len());
        let mut output = Vec::with_capacity(mic_frame.len());

        for (mic_chunk, ref_chunk) in mic_frame
            .chunks(self.frame_size)
            .zip(ref_samples.chunks(self.frame_size))
        {
            if mic_chunk.len() == self.frame_size && ref_chunk.len() == self.frame_size {
                let mut out_buf = vec![0i16; self.frame_size];
                self.aec.cancel_echo(mic_chunk, ref_chunk, &mut out_buf);
                output.extend_from_slice(&out_buf);
            } else {
                // Partial sub-frame at the end — pass through unchanged
                output.extend_from_slice(mic_chunk);
            }
        }

        output
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_push_pull_reference() {
        clear_reference();
        let frame = vec![100i16; 320];
        push_reference(&frame);
        let pulled = pull_reference(320);
        assert_eq!(pulled.len(), 320);
        assert_eq!(pulled[0], 100);
    }

    #[test]
    fn test_pull_empty_returns_zeros() {
        clear_reference();
        let pulled = pull_reference(320);
        assert_eq!(pulled.len(), 320);
        assert!(pulled.iter().all(|&s| s == 0));
    }

    #[test]
    fn test_buffer_capacity_cap() {
        clear_reference();
        // Push more than capacity
        let big_frame = vec![42i16; REF_BUFFER_CAPACITY + 1000];
        push_reference(&big_frame);
        let buf = get_ref_buffer();
        let guard = buf.lock().unwrap();
        assert!(guard.len() <= REF_BUFFER_CAPACITY);
    }

    #[test]
    fn test_echo_canceller_creation() {
        let ec = EchoCanceller::new();
        assert!(ec.is_some(), "EchoCanceller should initialize successfully");
    }

    #[test]
    fn test_echo_canceller_process() {
        clear_reference();
        let mut ec = EchoCanceller::new().expect("should init");
        // Push reference then process mic frame
        let ref_frame = vec![500i16; 320];
        push_reference(&ref_frame);
        let mic_frame = vec![500i16; 320];
        let output = ec.process(&mic_frame);
        assert_eq!(output.len(), 320);
    }
}
