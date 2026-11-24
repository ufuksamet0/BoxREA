#!/usr/bin/env bash
# BoxREA Provider Setup Script
# Installs and configures all REA providers for local development
# Usage: ./scripts/setup-providers.sh [--dry-run] [--provider <name>]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCKER_DIR="$PROJECT_ROOT/docker"
CONFIG_DIR="$PROJECT_ROOT/config"
TARGETS_DIR="$PROJECT_ROOT/targets"
EVIDENCE_DIR="$PROJECT_ROOT/evidence"
KUNA_CACHE_DIR="$PROJECT_ROOT/kuna_cache"
GHIDRA_SCRIPTS_DIR="$PROJECT_ROOT/ghidra_scripts"

# Default providers to install
PROVIDERS=("ghidra" "kuna" "firmware" "android" "network" "wabt" "pwntools" "jadx")
DRY_RUN=false
SELECTED_PROVIDERS=()

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --provider)
            SELECTED_PROVIDERS+=("$2")
            shift 2
            ;;
        --help)
            echo "Usage: $0 [--dry-run] [--provider <name>]"
            echo "Providers: ghidra, kuna, ida, firmware, android, network, wabt, pwntools, jadx, all"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# If specific providers selected, use those; otherwise use all
if [[ ${#SELECTED_PROVIDERS[@]} -gt 0 ]]; then
    PROVIDERS=("${SELECTED_PROVIDERS[@]}")
fi

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

run_cmd() {
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${YELLOW}[DRY-RUN]${NC} $1"
    else
        eval "$1"
    fi
}

check_docker() {
    log_info "Checking Docker installation..."
    if ! command -v docker &> /dev/null; then
        log_error "Docker not found. Please install Docker first."
        exit 1
    fi
    if ! command -v docker compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose not found. Please install Docker Compose."
        exit 1
    fi
    log_success "Docker and Docker Compose are available"
}

create_directories() {
    log_info "Creating project directories..."
    run_cmd "mkdir -p '$TARGETS_DIR' '$EVIDENCE_DIR' '$KUNA_CACHE_DIR' '$GHIDRA_SCRIPTS_DIR' '$CONFIG_DIR'"
    log_success "Directories created"
}

setup_ghidra() {
    log_info "Setting up Ghidra..."
    
    # Check if Ghidra is already installed locally
    if [[ -d "/opt/ghidra" ]] || [[ -d "$HOME/ghidra" ]]; then
        log_warn "Ghidra found locally. Docker will use /opt/ghidra path."
        return 0
    fi
    
    # Download Ghidra if not present
    GHIDRA_VERSION="11.2_PUBLIC"
    GHIDRA_URL="https://github.com/NationalSecurityAgency/ghidra/releases/download/Ghidra_${GHIDRA_VERSION}/ghidra_${GHIDRA_VERSION}.zip"
    GHIDRA_ZIP="/tmp/ghidra.zip"
    
    if [[ "$DRY_RUN" == "false" ]]; then
        log_info "Downloading Ghidra ${GHIDRA_VERSION}..."
        run_cmd "curl -L -o '$GHIDRA_ZIP' '$GHIDRA_URL'"
        log_info "Extracting Ghidra..."
        run_cmd "sudo unzip -q '$GHIDRA_ZIP' -d /opt/"
        run_cmd "sudo ln -sf /opt/ghidra_* /opt/ghidra"
        run_cmd "rm '$GHIDRA_ZIP'"
    else
        echo -e "${YELLOW}[DRY-RUN]${NC} Would download and extract Ghidra to /opt/ghidra"
    fi
    
    # Create Ghidra analysis scripts directory
    run_cmd "mkdir -p '$GHIDRA_SCRIPTS_DIR'"
    
    # Write a basic headless analysis script
    if [[ "$DRY_RUN" == "false" ]]; then
        cat > "$GHIDRA_SCRIPTS_DIR/analyze.java" << 'EOF'
import ghidra.app.script.GhidraScript;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.FunctionIterator;
import ghidra.util.task.TaskMonitor;

public class Analyze extends GhidraScript {
    @Override
    protected void run() throws Exception {
        FunctionIterator functions = currentProgram.getFunctionManager().getFunctions(true);
        println("Functions found: " + functions.getLength());
        while (functions.hasNext()) {
            Function f = functions.next();
            println("FUNC: " + f.getEntryPoint() + " " + f.getName());
        }
    }
}
EOF
    else
        echo -e "${YELLOW}[DRY-RUN]${NC} Would create Ghidra analysis script at $GHIDRA_SCRIPTS_DIR/analyze.java"
    fi
    
    log_success "Ghidra setup complete"
}

setup_kuna() {
    log_info "Setting up Kuna..."
    
    # Kuna is typically run via Docker, but we can also install the CLI
    if command -v kuna &> /dev/null; then
        log_success "Kuna CLI already installed"
        return 0
    fi
    
    # Install via cargo if Rust is available
    if command -v cargo &> /dev/null; then
        log_info "Installing Kuna via cargo..."
        run_cmd "cargo install --git https://github.com/morluto/kuna kuna-cli"
        log_success "Kuna installed via cargo"
    else
        log_warn "Rust/Cargo not found. Kuna will run via Docker only."
        log_info "To install Kuna locally: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    fi
}

setup_ida() {
    log_info "Checking IDA Pro..."
    
    if [[ -d "/opt/ida" ]] || [[ -d "$HOME/ida" ]]; then
        log_success "IDA Pro found locally"
    else
        log_warn "IDA Pro not found. Please install manually:"
        log_warn "  1. Download from https://hex-rays.com/ida-pro/"
        log_warn "  2. Install to /opt/ida or ~/ida"
        log_warn "  3. For MCP: docker run mrexodia/ida-pro-mcp"
    fi
}

setup_firmware_tools() {
    log_info "Setting up firmware analysis tools..."
    
    # Binwalk
    if ! command -v binwalk &> /dev/null; then
        log_info "Installing binwalk..."
        run_cmd "pip3 install binwalk --break-system-packages 2>/dev/null || pip3 install binwalk"
    fi
    
    # Unblob
    if ! command -v unblob &> /dev/null; then
        log_info "Installing unblob..."
        run_cmd "pip3 install unblob --break-system-packages 2>/dev/null || pip3 install unblob"
    fi
    
    # Jeffererson (JFFS2)
    if ! command -v jefferson &> /dev/null; then
        log_info "Installing jefferson..."
        run_cmd "pip3 install jefferson --break-system-packages 2>/dev/null || pip3 install jefferson"
    fi
    
    log_success "Firmware tools ready"
}

setup_android_tools() {
    log_info "Setting up Android analysis tools..."
    
    # JADX
    if ! command -v jadx &> /dev/null; then
        log_info "Installing JADX..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            run_cmd "brew install jadx"
        else
            JADX_VERSION="1.5.1"
            run_cmd "curl -L -o /tmp/jadx.zip https://github.com/skylot/jadx/releases/download/v${JADX_VERSION}/jadx-${JADX_VERSION}.zip"
            run_cmd "sudo unzip -q /tmp/jadx.zip -d /opt/jadx"
            run_cmd "sudo ln -sf /opt/jadx/bin/jadx /usr/local/bin/jadx"
            run_cmd "sudo ln -sf /opt/jadx/bin/jadx-gui /usr/local/bin/jadx-gui"
            run_cmd "rm /tmp/jadx.zip"
        fi
    fi
    
    # apktool
    if ! command -v apktool &> /dev/null; then
        log_info "Installing apktool..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            run_cmd "brew install apktool"
        else
            run_cmd "curl -L -o /usr/local/bin/apktool https://bitbucket.org/iBotPeaches/apktool/downloads/apktool_2.9.3.jar"
            run_cmd "chmod +x /usr/local/bin/apktool"
        fi
    fi
    
    # dex2jar
    if ! command -v d2j-dex2jar &> /dev/null; then
        log_info "Installing dex2jar..."
        run_cmd "curl -L -o /tmp/dex2jar.zip https://github.com/pxb1988/dex2jar/releases/download/v2.1/dex2jar-2.1.zip"
        run_cmd "sudo unzip -q /tmp/dex2jar.zip -d /opt/dex2jar"
        run_cmd "sudo ln -sf /opt/dex2jar/dex2jar-2.1/d2j-dex2jar.sh /usr/local/bin/d2j-dex2jar"
        run_cmd "rm /tmp/dex2jar.zip"
    fi
    
    log_success "Android tools ready"
}

setup_network_tools() {
    log_info "Setting up network analysis tools..."
    
    # tshark (Wireshark CLI)
    if ! command -v tshark &> /dev/null; then
        log_info "Installing tshark..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            run_cmd "brew install wireshark"
        else
            run_cmd "apt-get update && apt-get install -y tshark"
        fi
    fi
    
    # mitmproxy
    if ! command -v mitmproxy &> /dev/null; then
        log_info "Installing mitmproxy..."
        run_cmd "pip3 install mitmproxy --break-system-packages 2>/dev/null || pip3 install mitmproxy"
    fi
    
    log_success "Network tools ready"
}

setup_wabt() {
    log_info "Setting up WABT (WebAssembly Binary Toolkit)..."
    
    if ! command -v wasm2wat &> /dev/null; then
        log_info "Installing WABT..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            run_cmd "brew install wabt"
        else
            WABT_VERSION="1.0.34"
            run_cmd "curl -L -o /tmp/wabt.tar.gz https://github.com/WebAssembly/wabt/releases/download/${WABT_VERSION}/wabt-${WABT_VERSION}-ubuntu.tar.gz"
            run_cmd "sudo tar -xzf /tmp/wabt.tar.gz -C /opt/"
            run_cmd "sudo ln -sf /opt/wabt-*/bin/* /usr/local/bin/"
            run_cmd "rm /tmp/wabt.tar.gz"
        fi
    fi
    
    log_success "WABT ready"
}

setup_pwntools() {
    log_info "Setting up pwntools..."
    
    if ! python3 -c "import pwnlib" 2>/dev/null; then
        log_info "Installing pwntools..."
        run_cmd "pip3 install pwntools --break-system-packages 2>/dev/null || pip3 install pwntools"
    fi
    
    log_success "pwntools ready"
}

setup_jadx() {
    # Already covered in setup_android_tools
    setup_android_tools
}

setup_docker_compose() {
    log_info "Setting up Docker Compose environment..."
    
    # Create .env file for docker-compose
    cat > "$DOCKER_DIR/.env" << EOF
# BoxREA Docker Compose Environment
# Generated by setup-providers.sh

TARGETS_DIR=$TARGETS_DIR
EVIDENCE_DIR=$EVIDENCE_DIR
REA_CONFIG_DIR=$CONFIG_DIR
KUNA_CACHE_DIR=$KUNA_CACHE_DIR
GHIDRA_SCRIPTS_DIR=$GHIDRA_SCRIPTS_DIR
IDA_LICENSE_DIR=$PROJECT_ROOT/ida_license
CAPTURES_DIR=$PROJECT_ROOT/captures
EOF
    
    # Pull Docker images
    if [[ "$DRY_RUN" == "false" ]]; then
        log_info "Pulling Docker images (this may take a while)..."
        cd "$DOCKER_DIR"
        docker compose pull --ignore-pull-failures
        log_success "Docker images pulled"
    else
        echo -e "${YELLOW}[DRY-RUN]${NC} Would pull Docker images"
    fi
}

verify_setup() {
    log_info "Verifying setup..."
    
    local all_good=true
    
    # Check each provider
    for provider in "${PROVIDERS[@]}"; do
        case $provider in
            ghidra)
                if [[ -d "/opt/ghidra" ]] || docker image inspect ghcr.io/morluto/ghidra-headless:11.2 &>/dev/null; then
                    log_success "  ✓ Ghidra"
                else
                    log_warn "  ✗ Ghidra (not found locally, Docker image may need pull)"
                    all_good=false
                fi
                ;;
            kuna)
                if command -v kuna &> /dev/null || docker image inspect ghcr.io/morluto/kuna:latest &>/dev/null; then
                    log_success "  ✓ Kuna"
                else
                    log_warn "  ✗ Kuna (Docker image may need pull)"
                    all_good=false
                fi
                ;;
            firmware)
                if command -v binwalk &> /dev/null && command -v unblob &> /dev/null; then
                    log_success "  ✓ Firmware tools"
                else
                    log_warn "  ✗ Firmware tools (some missing)"
                    all_good=false
                fi
                ;;
            android)
                if command -v jadx &> /dev/null && command -v apktool &> /dev/null; then
                    log_success "  ✓ Android tools"
                else
                    log_warn "  ✗ Android tools (some missing)"
                    all_good=false
                fi
                ;;
            network)
                if command -v tshark &> /dev/null && command -v mitmproxy &> /dev/null; then
                    log_success "  ✓ Network tools"
                else
                    log_warn "  ✗ Network tools (some missing)"
                    all_good=false
                fi
                ;;
            wabt)
                if command -v wasm2wat &> /dev/null; then
                    log_success "  ✓ WABT"
                else
                    log_warn "  ✗ WABT"
                    all_good=false
                fi
                ;;
            pwntools)
                if python3 -c "import pwnlib" 2>/dev/null; then
                    log_success "  ✓ pwntools"
                else
                    log_warn "  ✗ pwntools"
                    all_good=false
                fi
                ;;
        esac
    done
    
    # Check REA MCP
    if docker image inspect ghcr.io/morluto/rea-agents:6.7.0 &>/dev/null; then
        log_success "  ✓ REA MCP"
    else
        log_warn "  ✗ REA MCP (Docker image may need pull)"
        all_good=false
    fi
    
    if [[ "$all_good" == "true" ]]; then
        log_success "All providers verified successfully!"
    else
        log_warn "Some providers need attention. Run with --dry-run to see what would be installed."
    fi
}

# Main execution
main() {
    echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║     BoxREA Provider Setup Script         ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
    echo ""
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_warn "Running in DRY-RUN mode - no changes will be made"
        echo ""
    fi
    
    check_docker
    create_directories
    
    for provider in "${PROVIDERS[@]}"; do
        case $provider in
            ghidra) setup_ghidra ;;
            kuna) setup_kuna ;;
            ida) setup_ida ;;
            firmware) setup_firmware_tools ;;
            android) setup_android_tools ;;
            network) setup_network_tools ;;
            wabt) setup_wabt ;;
            pwntools) setup_pwntools ;;
            jadx) setup_jadx ;;
            all) 
                setup_ghidra
                setup_kuna
                setup_ida
                setup_firmware_tools
                setup_android_tools
                setup_network_tools
                setup_wabt
                setup_pwntools
                ;;
            *)
                log_warn "Unknown provider: $provider"
                ;;
        esac
    done
    
    setup_docker_compose
    verify_setup
    
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║         Setup Complete!                  ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Start providers:  cd docker && docker compose up -d"
    echo "  2. Test REA MCP:     npx -y rea-agents@6.7.0 doctor --client opencode --json"
    echo "  3. Begin Phase 1:    Core library development"
    echo ""
}

main "$@"