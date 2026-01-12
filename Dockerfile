FROM rust:1.86-slim

SHELL ["bash", "-c"]

# Install system dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    protobuf-compiler \
    clang \
    make \
    jq \
    git \
    curl

# Install Linera from testnet_conway branch
RUN git clone https://github.com/linera-io/linera-protocol.git && \
    cd linera-protocol && \
    git checkout -t origin/testnet_conway && \
    git checkout 288296873fb92eda7ced5e825d5c1d0dd49aec42 && \
    cargo install --locked --path linera-storage-service && \
    cargo install --locked --path linera-service

# Install Node.js for frontend server
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g http-server

WORKDIR /build

# Health check for frontend
HEALTHCHECK CMD ["curl", "-s", "http://localhost:5173"]

# Entry point runs the deployment script
ENTRYPOINT bash /build/run.bash
