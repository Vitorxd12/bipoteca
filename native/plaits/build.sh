#!/usr/bin/env sh
# Compila o Plaits para WebAssembly e copia para public/. Precisa do alvo
# wasm32-unknown-unknown (rustup target add wasm32-unknown-unknown).
set -e
cd "$(dirname "$0")"
# Tira caminhos da máquina de quem compilou de dentro do binário.
CARGO_HOME="${CARGO_HOME:-$HOME/.cargo}"
RUSTUP_HOME="${RUSTUP_HOME:-$HOME/.rustup}"
RUSTFLAGS="--remap-path-prefix=$CARGO_HOME=/cargo --remap-path-prefix=$RUSTUP_HOME=/rustup --remap-path-prefix=$PWD=/plaits" \
  cargo build --release --target wasm32-unknown-unknown
cp target/wasm32-unknown-unknown/release/bipoteca_plaits.wasm ../../public/plaits/plaits.wasm
ls -la ../../public/plaits/plaits.wasm
