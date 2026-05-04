import sys
import json
import logging

# Disable verbose logging from transformers
logging.getLogger("transformers").setLevel(logging.ERROR)

def main():
    try:
        from llmlingua import PromptCompressor
    except ImportError:
        print(json.dumps({"error": "llmlingua not installed"}), file=sys.stderr)
        sys.exit(1)

    try:
        data = json.load(sys.stdin)
        text = data.get("text", "")
        rate = data.get("rate", 0.6)
        
        # In a production scenario, we'd want to cache this object
        compressor = PromptCompressor(
            model_name="microsoft/llmlingua-2-xlm-roberta-large-meetingbank",
            use_llmlingua2=True,
            device_map="cpu",
        )
        
        result = compressor.compress_prompt(
            text,
            rate=rate,
            use_llmlingua2=True
        )
        
        print(json.dumps({
            "compressed": result["compressed_prompt"],
            "original_tokens": result["origin_tokens"],
            "compressed_tokens": result["compressed_tokens"],
            "ratio": result["ratio"]
        }))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
