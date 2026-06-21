extension microsoftGraph

targetScope = 'resourceGroup'

@description('Prefix for all Azure resources.')
param namePrefix string = 'eun-p-nightwatch'

@description('Deployment location')
param location string = resourceGroup().location

@secure()
param sqlAdminPassword string

param sqlAdminUser string = 'sqlnightwatchadmin'
param enableAppInsightsWorkspace bool = true
param allowAzureServicesToSql bool = true

@description('Display name for the Entra ID app registration.')
param appDisplayName string = 'NightWatch MSAL'

@description('Set of redirect URIs to register on the SPA (e.g. localhost for local dev).')
param additionalRedirectUris array = ['http://localhost:5173']

var appRoles = [
  {
    id: '00000000-0000-0000-0000-000000000001'
    allowedMemberTypes: ['User', 'Application']
    description: 'Full administrative access to NightWatch.'
    displayName: 'NightWatch.Admin'
    isEnabled: true
    value: 'NightWatch.Admin'
  }
  {
    id: '00000000-0000-0000-0000-000000000002'
    allowedMemberTypes: ['User', 'Application']
    description: 'Operational read/write access to NightWatch.'
    displayName: 'NightWatch.Operator'
    isEnabled: true
    value: 'NightWatch.Operator'
  }
  {
    id: '00000000-0000-0000-0000-000000000003'
    allowedMemberTypes: ['User', 'Application']
    description: 'Read-only access to NightWatch.'
    displayName: 'NightWatch.Reader'
    isEnabled: true
    value: 'NightWatch.Reader'
  }
]

var tags = {
  app: 'AzureNightWatch'
  env: 'poc'
  owner: 'platform'
}

var appRegistrationUniqueName = '${namePrefix}-nightwatch'

resource appInsights 'microsoft.insights/components@2020-02-02' = {
  name: '${namePrefix}-appi'
  location: location
  kind: 'web'
  tags: tags
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: enableAppInsightsWorkspace ? law.id : null
  }
}

resource law 'microsoft.operationalinsights/workspaces@2023-09-01' = if (enableAppInsightsWorkspace) {
  name: '${namePrefix}-law'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${namePrefix}-kv'
  location: location
  tags: tags
  properties: {
    enableRbacAuthorization: true
    tenantId: subscription().tenantId
    sku: {
      name: 'standard'
      family: 'A'
    }
  }
}

resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' = {
  name: '${namePrefix}-sqlsrv'
  location: location
  tags: tags
  properties: {
    administratorLogin: sqlAdminUser
    administratorLoginPassword: sqlAdminPassword
    version: '12.0'
    publicNetworkAccess: 'Enabled'
  }
}

resource sqlAllowAzureFirewall 'Microsoft.Sql/servers/firewallRules@2023-08-01-preview' = if (allowAzureServicesToSql) {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource sqlDb 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: sqlServer
  name: 'nightwatchdb'
  location: location
  sku: {
    name: 'Basic'
    tier: 'Basic'
  }
  properties: {
    zoneRedundant: false
  }
}

resource appPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${namePrefix}-asp'
  location: location
  tags: tags
  sku: {
    name: 'F1'
    tier: 'Free'
    capacity: 1
  }
  properties: {
    reserved: false
  }
}

resource apiApp 'Microsoft.Web/sites@2023-12-01' = {
  name: '${namePrefix}-api'
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appPlan.id
    httpsOnly: true
    siteConfig: {
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      appSettings: [
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
        {
          name: 'ConnectionStrings__SqlDatabase'
          value: 'Server=tcp:${sqlServer.name}${environment().suffixes.sqlServerHostname},1433;Initial Catalog=${sqlDb.name};Persist Security Info=False;User ID=${sqlAdminUser};Password=${sqlAdminPassword};MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;'
        }
        {
          name: 'AzureAd__TenantId'
          value: 'organizations'
        }
        {
          name: 'AzureAd__Audience'
          value: 'api://${nightwatchApp.appId}'
        }
      ]
    }
  }
}

resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: '${namePrefix}-web'
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appPlan.id
    httpsOnly: true
    siteConfig: {
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      appSettings: [
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
        {
          name: 'VITE_API_BASE_URL'
          value: 'https://${apiApp.properties.defaultHostName}'
        }
      ]
    }
  }
}

output apiUrl string = 'https://${apiApp.properties.defaultHostName}'
output webUrl string = 'https://${webApp.properties.defaultHostName}'
output keyVaultName string = keyVault.name
output apiAppName string = apiApp.name
output webAppName string = webApp.name

// ---------- Entra ID app registration ----------

resource nightwatchApp 'Microsoft.Graph/applications@v1.0' = {
  displayName: appDisplayName
  uniqueName: appRegistrationUniqueName
  signInAudience: 'AzureADMultipleOrgs'
  appRoles: appRoles
  api: {
    requestedAccessTokenVersion: 2
    oauth2PermissionScopes: [
      {
        id: '00000000-0000-0000-0000-000000000010'
        adminConsentDescription: 'Allows the app to call the NightWatch API on behalf of the signed-in user.'
        adminConsentDisplayName: 'Access NightWatch API'
        isEnabled: true
        type: 'User'
        value: 'user_impersonation'
      }
    ]
  }
  spa: {
    redirectUris: additionalRedirectUris
  }
}

resource nightwatchSp 'Microsoft.Graph/servicePrincipals@v1.0' = {
  appId: nightwatchApp.appId
}

// ---------- Subscription-scope RBAC for managed identity ----------

module subscriptionRbac 'modules/subscription-rbac.bicep' = {
  name: 'nightwatch-subscription-rbac'
  scope: subscription()
  params: {
    principalId: apiApp.identity.principalId
  }
}

output appRegistrationClientId string = nightwatchApp.appId
