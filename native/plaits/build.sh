#!/usr/bin/env sh
# Compila o Plaits para WebAssembly e copia para public/. Precisa do alvo
# wasm32-unknown-unknown (rustup target add wasm32-unknown-unknown).
set -e
cd "$(dirname "$0")"
cargo build --release --target wasm32-unknown-unknown
cp target/wasm32-unknown-unknown/release/bipoteca_plaits.wasm ../../public/plaits/plaits.wasm
ls -la ../../public/plaits/plaits.wasm
