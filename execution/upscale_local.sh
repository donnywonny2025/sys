#!/bin/bash
# Local Execution Script: Fast CoreGraphics Upscaler
# Uses native macOS sips to scale 2x without cloud AI costs.

if [ -z "$1" ]; then
    echo "ERROR|No input file specified"
    exit 1
fi

INPUT_FILE="$1"

# Automatically append "_upscaled" to the original file name
BASENAME=$(basename "$INPUT_FILE")
DIRNAME=$(dirname "$INPUT_FILE")
FILENAME="${BASENAME%.*}"
EXTENSION="${BASENAME##*.}"
OUTPUT_FILE="$DIRNAME/${FILENAME}_upscaled.$EXTENSION"

# Get native dimensions using macOS sips tool
WIDTH=$(sips -g pixelWidth "$INPUT_FILE" | tail -n1 | awk '{print $NF}')
HEIGHT=$(sips -g pixelHeight "$INPUT_FILE" | tail -n1 | awk '{print $NF}')

if [ -z "$WIDTH" ] || [ -z "$HEIGHT" ]; then
    echo "ERROR|Failed to extract dimensions from $INPUT_FILE"
    exit 1
fi

# Double the resolution (2x native upscaler)
NEW_WIDTH=$((WIDTH * 2))
NEW_HEIGHT=$((HEIGHT * 2))

# Execute the CoreGraphics interpolation scaling
sips -z $NEW_HEIGHT $NEW_WIDTH "$INPUT_FILE" --out "$OUTPUT_FILE" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "SUCCESS|$OUTPUT_FILE|$NEW_WIDTH"x"$NEW_HEIGHT"
else
    echo "ERROR|Failed to scale image"
    exit 1
fi
