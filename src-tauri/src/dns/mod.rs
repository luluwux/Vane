pub mod manager;
pub mod doh;
pub mod forwarder;

pub use manager::{
    DnsProvider, NetworkAdapter, ApplyDnsResult,
    builtin_providers, get_active_adapters, apply_dns,
    reset_dns_to_dhcp, is_using_trusted_dns,
};
pub use doh::{resolve_doh, DohResult, DOH_CLOUDFLARE, DOH_GOOGLE};
pub use forwarder::{ForwarderHandle, DoHEndpoint, spawn_doh_forwarder, DOH_FORWARDER_DEFAULT_PORT};
