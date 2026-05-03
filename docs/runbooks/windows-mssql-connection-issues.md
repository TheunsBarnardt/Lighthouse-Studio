# Runbook: MSSQL Connection Issues on Windows

**Symptom:** Platform services start but fail to connect to SQL Server. Logs show errors like `connect ECONNREFUSED`, `Login failed`, `Unable to connect to SQL Server`, or `Connection timeout`.

---

## Step 1: Verify the connection string

```powershell
# Check the DATABASE_URL in the env file
Select-String "DATABASE_URL" C:\Platform\.env
```

Expected format: `mssql://username:password@hostname/database`

Verify each component:

- **hostname**: resolvable from this server
- **username/password**: valid SQL Server credentials
- **database**: database exists and user has access

---

## Step 2: Test basic connectivity

```powershell
# Test TCP connectivity to SQL Server (default port 1433)
Test-NetConnection -ComputerName <sql-server-hostname> -Port 1433
```

Expected: `TcpTestSucceeded: True`

If False:

- SQL Server is not listening on TCP. Enable via SQL Server Configuration Manager → SQL Server Network Configuration → Protocols for MSSQLSERVER → TCP/IP → Enable.
- Windows Firewall on the SQL Server is blocking port 1433. Add inbound rule.
- A network firewall between app server and SQL Server is blocking the connection.

---

## Step 3: Test authentication with sqlcmd

```powershell
sqlcmd -S <hostname> -U <username> -P <password> -Q "SELECT @@VERSION"
```

| Error                                             | Cause                                    | Fix                                                     |
| ------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------- |
| `Login failed for user`                           | Wrong credentials or user not created    | Verify credentials; check SQL Server logins             |
| `Cannot open database`                            | Database name wrong or user lacks access | Verify database name; grant db_datareader/db_datawriter |
| `SSL Provider: error:1416F086`                    | SSL/TLS negotiation failure              | See Step 4                                              |
| `Named Pipes Provider: Could not open connection` | TCP not enabled                          | See Step 2                                              |

---

## Step 4: SSL/TLS encryption issues

SQL Server 2022 enforces encrypted connections by default. If the Node app connects without TLS, add `encrypt=true` and `trustServerCertificate=true` (for self-signed certs) to the connection string:

```
mssql://username:password@hostname/database?encrypt=true&trustServerCertificate=true
```

For production with a CA-signed certificate, use `encrypt=true&trustServerCertificate=false`.

---

## Step 5: Check CDC is enabled

The change stream adapter requires CDC. Verify:

```sql
-- Run in SQL Server Management Studio or sqlcmd
USE platform;
SELECT name, is_cdc_enabled FROM sys.databases WHERE name = 'platform';
-- is_cdc_enabled should be 1
```

If 0, enable CDC:

```sql
EXEC sys.sp_cdc_enable_db;
```

Also verify SQL Server Agent is running:

```powershell
Get-Service SQLSERVERAGENT | Select-Object Status
# Expected: Running
```

---

## Step 6: Check connection pool exhaustion

If the platform starts but intermittently fails with connection errors, the pool may be exhausted:

Check Node logs for `ConnectionError: Connection pool is exhausted`:

```powershell
Get-Content C:\Platform\logs\web\current.log | Select-String "pool" | Tail -20
```

Increase the pool size via the connection string: `...&connectionLimit=20` (default: 10).

---

## Step 7: Firewall rules summary

Required inbound rule on SQL Server:

- Protocol: TCP
- Port: 1433
- Source: Application server IP

Verify:

```powershell
# Run on SQL Server machine
Get-NetFirewallRule -DisplayName "*SQL*" | Get-NetFirewallPortFilter | Select-Object LocalPort
```
