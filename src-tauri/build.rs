use std::env;
use std::fs;
use std::path::PathBuf;

fn main() {
    tauri_build::build();

    // -----------------------------------------------------------------------
    // Copy sidecar binary into the output dir so `tauri dev` can find it.
    //
    // The shell plugin's sidecar("binaries/streamforge-server") resolves to:
    //   <exe_dir>/binaries/streamforge-server.exe   (on Windows)
    //
    // During `tauri dev` the exe lives in target/debug/, so the sidecar
    // must be at target/debug/binaries/streamforge-server.exe
    //
    // The source binary in src-tauri/binaries/ uses the Tauri naming
    // convention: streamforge-server-{target_triple}[.exe]
    // -----------------------------------------------------------------------

    let target_triple = env::var("TARGET").unwrap();
    let profile_dir: PathBuf = env::var("OUT_DIR")
        .map(PathBuf::from)
        .unwrap()
        // OUT_DIR is something like target/debug/build/<crate>/out
        // Walk up to the profile dir (target/debug/)
        .ancestors()
        .nth(3)
        .unwrap()
        .to_path_buf();

    let ext = if target_triple.contains("windows") {
        ".exe"
    } else {
        ""
    };

    let src = PathBuf::from(format!("binaries/streamforge-server-{target_triple}{ext}"));

    // The plugin resolves the path preserving the "binaries/" subdirectory
    let dst_dir = profile_dir.join("binaries");
    let dst = dst_dir.join(format!("streamforge-server{ext}"));

    if src.exists() {
        fs::create_dir_all(&dst_dir)
            .unwrap_or_else(|e| panic!("Failed to create {}: {}", dst_dir.display(), e));
        fs::copy(&src, &dst).unwrap_or_else(|e| {
            panic!(
                "Failed to copy sidecar from {} to {}: {}",
                src.display(),
                dst.display(),
                e
            )
        });
        println!("cargo:warning=Copied sidecar to {}", dst.display());
    } else {
        println!(
            "cargo:warning=Sidecar binary not found at {}. \
             Run `npm run build:server` first.",
            src.display()
        );
    }

    // Re-run if the source binary changes
    println!("cargo:rerun-if-changed=binaries/");
}
