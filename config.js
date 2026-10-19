// Microsoft Entra app registration. See README.md -> "Connect Microsoft Teams".
// Google OAuth client IDs are public identifiers; never put a client secret in this static app.
window.APP_CONFIG = {
  clientId: "",
  googleClientId: "35533178618-2sjtm3tklmh2sjq9rk62p6nptd87coc6.apps.googleusercontent.com",
  tenantId: "organizations",
  scopes: ["User.Read", "Team.ReadBasic.All", "Channel.ReadBasic.All", "Files.Read.All"],
};
