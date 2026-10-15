// Microsoft Entra app registration. See README.md -> "Connect Microsoft Teams".
// With no clientId, the teacher workspace remains available in demo mode.
window.APP_CONFIG = {
  clientId: "",                 // Application (client) ID
  tenantId: "organizations",    // Your school's Directory (tenant) ID, or "organizations"
  scopes: [
    "User.Read",
    "Team.ReadBasic.All",
    "Channel.ReadBasic.All",
    "Files.Read.All",
  ],
};
