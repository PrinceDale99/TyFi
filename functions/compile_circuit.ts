import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

function main() {
    console.log("Compiling Noir ZK Circuit...");
    
    // In Render/Linux, nargo can be seamlessly utilized natively
    const isWindows = process.platform === 'win32';
    if (isWindows) {
        console.log("Skipping native nargo compilation on Windows. (Falling back to simulated json in development)");
        return;
    }

    try {
        const circuitDir = path.resolve(__dirname, '../circuits/weather_oracle');
        
        console.log("Installing nargo natively...");
        execSync('curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash', { stdio: 'inherit' });
        
        // Use noirup to install nargo
        execSync('~/.nargo/bin/noirup', { stdio: 'inherit', shell: '/bin/bash' });
        
        console.log("Executing nargo compile...");
        execSync('~/.nargo/bin/nargo compile', { cwd: circuitDir, stdio: 'inherit', shell: '/bin/bash' });
        
        console.log("Successfully compiled REAL Noir circuit.");
    } catch (e: any) {
        console.error("Native compilation failed:", e.message);
    }
}

main();
