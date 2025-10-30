#!/usr/bin/env python3
"""Test script for caption mode functionality."""

import requests
import json
import time
import sys

API_BASE = "http://localhost:8000"

def set_caption(text, language=None, duration_seconds=None, target_client_id=None):
    """Set a caption to be displayed."""
    payload = {"text": text}
    if language:
        payload["language"] = language
    if duration_seconds:
        payload["duration_seconds"] = duration_seconds
    
    params = {}
    if target_client_id:
        params["target_client_id"] = target_client_id
    
    url = f"{API_BASE}/api/captions"
    print(f"POST {url}")
    print(f"Payload: {json.dumps(payload, ensure_ascii=False)}")
    
    response = requests.post(url, json=payload, params=params)
    print(f"Response: {response.status_code}")
    result = response.json()
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return result


def get_caption(client_id=None):
    """Get the current caption."""
    params = {}
    if client_id:
        params["client"] = client_id
    
    url = f"{API_BASE}/api/captions"
    print(f"GET {url}")
    response = requests.get(url, params=params)
    print(f"Response: {response.status_code}")
    result = response.json()
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return result


def clear_caption(target_client_id=None):
    """Clear the current caption."""
    params = {}
    if target_client_id:
        params["target_client_id"] = target_client_id
    
    url = f"{API_BASE}/api/captions"
    print(f"DELETE {url}")
    response = requests.delete(url, params=params)
    print(f"Response: {response.status_code}")


def test_basic_caption():
    """Test basic caption display."""
    print("\n" + "="*60)
    print("Test 1: Basic Caption Display")
    print("="*60)
    
    set_caption(
        text="圖像系譜學",
        language="zh-TW",
        duration_seconds=10
    )
    
    print("\nCaption set. Visit: http://localhost:5173/?caption_mode=true")
    print("You should see the caption displayed for 10 seconds...")
    
    time.sleep(2)
    get_caption()


def test_multiple_captions():
    """Test displaying multiple captions in sequence."""
    print("\n" + "="*60)
    print("Test 2: Multiple Captions in Sequence")
    print("="*60)
    
    captions = [
        "圖像系譜學",
        "邁向視覺探索",
        "連接過去與現在",
        "藝術與技術的融合"
    ]
    
    for i, caption_text in enumerate(captions, 1):
        print(f"\n--- Caption {i} ---")
        set_caption(
            text=caption_text,
            language="zh-TW",
            duration_seconds=5
        )
        print("Waiting for caption to display (5 seconds)...")
        time.sleep(6)


def test_client_specific_caption():
    """Test sending caption to specific client."""
    print("\n" + "="*60)
    print("Test 3: Client-Specific Caption")
    print("="*60)
    
    print("\nSetting caption for client 'display_1'...")
    set_caption(
        text="左屏幕",
        language="zh-TW",
        duration_seconds=5,
        target_client_id="display_1"
    )
    
    print("\nSetting caption for client 'display_2'...")
    set_caption(
        text="右屏幕",
        language="zh-TW",
        duration_seconds=5,
        target_client_id="display_2"
    )
    
    print("\nBoth captions are set. Connect two clients with different client IDs:")
    print("  Client 1: http://localhost:5173/?caption_mode=true&client=display_1")
    print("  Client 2: http://localhost:5173/?caption_mode=true&client=display_2")


def test_clear_caption():
    """Test clearing caption."""
    print("\n" + "="*60)
    print("Test 4: Clear Caption")
    print("="*60)
    
    print("\nSetting a caption...")
    set_caption(text="即將清除", language="zh-TW")
    
    time.sleep(2)
    
    print("\nClearing caption...")
    clear_caption()
    
    time.sleep(1)
    
    print("\nVerifying caption is cleared...")
    get_caption()


def main():
    """Run tests."""
    try:
        # Test connection
        print("Testing connection to API...")
        response = requests.get(f"{API_BASE}/health")
        if response.status_code != 200:
            print("Failed to connect to API")
            sys.exit(1)
        print("✓ API connection successful\n")
        
        if len(sys.argv) > 1:
            test_name = sys.argv[1].lower()
            if test_name == "basic":
                test_basic_caption()
            elif test_name == "multiple":
                test_multiple_captions()
            elif test_name == "client":
                test_client_specific_caption()
            elif test_name == "clear":
                test_clear_caption()
            else:
                print(f"Unknown test: {test_name}")
                print("Available tests: basic, multiple, client, clear")
                sys.exit(1)
        else:
            print("Usage: python test_caption_mode.py [test_name]")
            print("\nAvailable tests:")
            print("  basic    - Basic caption display")
            print("  multiple - Multiple captions in sequence")
            print("  client   - Client-specific captions")
            print("  clear    - Clear caption test")
            print("\nExample:")
            print("  python test_caption_mode.py basic")
            
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
