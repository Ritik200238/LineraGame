.PHONY: build test clean

build:
	cargo build --target wasm32-unknown-unknown --release

test:
	cargo test
	cd abi && cargo test

clean:
	cargo clean
	cd abi && cargo clean

lint:
	cargo clippy --all-targets --all-features -- -D warnings

fmt:
	cargo fmt --all -- --check
