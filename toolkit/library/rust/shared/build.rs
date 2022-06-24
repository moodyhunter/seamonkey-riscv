extern crate rustc_version;

use rustc_version::{version, Version};

fn main() {
    let ver = version().unwrap();

    // Version checking removed. Lets just assume the oom hooks are always available.
    
    // This is a rather awful thing to do, but we're only doing it on
    // versions of rustc that are not going to change the unstable APIs
    // we use from under us, all being already released or beta.
    if ver < Version::parse("1.50.0").unwrap() {
        println!("cargo:rustc-env=RUSTC_BOOTSTRAP=1");
    }
}
