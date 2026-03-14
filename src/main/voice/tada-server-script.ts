// TADA server Python script - embedded as a string for bundling
// This gets written to disk at runtime and executed with the TADA venv Python

export const TADA_SERVER_SCRIPT = `#!/usr/bin/env python3
"""TADA TTS server - persistent process for speech synthesis.

Communicates via JSON lines on stdin/stdout.
Commands:
  {"cmd": "load", "voice_sample": "/path/to/sample.wav"}
  {"cmd": "speak", "text": "Hello world"}
  {"cmd": "status"}
  {"cmd": "quit"}
"""

import sys
import json
import base64
import io
import os
import gc
import time
import traceback

_stderr = sys.stderr

def log(msg):
    print(msg, file=_stderr, flush=True)

def respond(data):
    print(json.dumps(data), flush=True)

def main():
    log("TADA server starting...")

    try:
        import torch
        import soundfile as sf

        import torchaudio
        def _safe_load(filepath, *args, **kwargs):
            data, sr = sf.read(str(filepath))
            t = torch.tensor(data, dtype=torch.float32)
            if t.dim() == 1:
                t = t.unsqueeze(0)
            else:
                t = t.T
            return t, sr
        torchaudio.load = _safe_load

        from tada.modules.encoder import Encoder
        from tada.modules.tada import TadaForCausalLM
        from tada.modules.decoder import Decoder

    except ImportError as e:
        respond({"error": f"Missing dependency: {e}", "ready": False})
        sys.exit(1)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    log(f"TADA device: {device}")

    model = None
    decoder = None
    current_prompt = None
    current_voice_sample = None

    def load_voice(voice_sample_path):
        nonlocal model, decoder, current_prompt, current_voice_sample

        if not os.path.isfile(voice_sample_path):
            return {"error": f"Voice sample not found: {voice_sample_path}"}

        try:
            if current_voice_sample == voice_sample_path and current_prompt is not None and model is not None:
                return {"success": True, "cached": True}

            log(f"Loading encoder for voice: {voice_sample_path}")
            encoder = Encoder.from_pretrained("HumeAI/tada-codec", subfolder="encoder").to(device)

            audio, sample_rate = torchaudio.load(voice_sample_path)
            audio = audio.to(device)
            log(f"Voice sample: {audio.shape}, {sample_rate} Hz")

            with torch.no_grad():
                prompt = encoder(audio, sample_rate=sample_rate)

            encoder.cpu()
            del encoder
            gc.collect()
            if device == "cuda":
                torch.cuda.empty_cache()

            if model is None:
                log("Loading TADA model...")
                model = TadaForCausalLM.from_pretrained(
                    "HumeAI/tada-1b", dtype=torch.bfloat16
                ).to(device)

                log("Loading decoder...")
                decoder = Decoder.from_pretrained(
                    "HumeAI/tada-codec", subfolder="decoder"
                ).to(device)
                model._decoder = decoder

                _orig_decode_wav = model._decode_wav
                def _patched_decode_wav(encoded, time_before):
                    return _orig_decode_wav(encoded.float(), time_before=time_before)
                model._decode_wav = _patched_decode_wav

            for attr in dir(prompt):
                val = getattr(prompt, attr, None)
                if isinstance(val, torch.Tensor) and val.is_floating_point():
                    setattr(prompt, attr, val.to(torch.bfloat16))

            current_prompt = prompt
            current_voice_sample = voice_sample_path

            if device == "cuda":
                free_mb = torch.cuda.mem_get_info()[0] / 1024**2
                log(f"Model ready, {free_mb:.0f} MiB GPU free")

            return {"success": True, "cached": False}

        except Exception as e:
            log(f"Error loading voice: {traceback.format_exc()}")
            return {"error": str(e)}

    def speak(text):
        if model is None or current_prompt is None:
            return {"error": "No voice loaded. Send a 'load' command first."}

        try:
            t0 = time.time()
            with torch.no_grad():
                output = model.generate(prompt=current_prompt, text=text)

            audio_tensor = output.audio[0]
            if audio_tensor is None:
                return {"error": "Generation produced no audio"}

            elapsed = time.time() - t0
            duration = audio_tensor.shape[0] / 24000
            log(f"Generated {duration:.2f}s audio in {elapsed:.2f}s ({elapsed/duration:.2f}x RTF)")

            audio_np = audio_tensor.float().cpu().numpy()
            peak = max(abs(audio_np.max()), abs(audio_np.min()))
            if peak > 0:
                audio_np = audio_np / peak * 0.9

            buf = io.BytesIO()
            sf.write(buf, audio_np, 24000, format='WAV', subtype='PCM_16')
            b64 = base64.b64encode(buf.getvalue()).decode('ascii')

            return {"success": True, "audioData": b64, "duration": duration, "elapsed": elapsed}

        except Exception as e:
            log(f"Error speaking: {traceback.format_exc()}")
            return {"error": str(e)}

    respond({"ready": True, "device": device})

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            cmd = json.loads(line)
        except json.JSONDecodeError as e:
            respond({"error": f"Invalid JSON: {e}"})
            continue

        action = cmd.get("cmd")

        if action == "load":
            result = load_voice(cmd.get("voice_sample", ""))
            respond(result)

        elif action == "speak":
            result = speak(cmd.get("text", ""))
            respond(result)

        elif action == "status":
            respond({
                "loaded": model is not None,
                "voice_sample": current_voice_sample,
                "device": device,
                "gpu_free_mb": torch.cuda.mem_get_info()[0] / 1024**2 if device == "cuda" else None
            })

        elif action == "quit":
            respond({"bye": True})
            break

        else:
            respond({"error": f"Unknown command: {action}"})

    log("TADA server shutting down.")


if __name__ == "__main__":
    main()
`
