# Runbook: Windows Event Log Troubleshooting

**Purpose:** Finding, filtering, and interpreting platform log entries in Windows Event Log.

---

## Event Log sources

The platform registers two Event Log sources during service install:

| Source name       | Service         | Default log     |
| ----------------- | --------------- | --------------- |
| `Platform Web`    | Platform Web    | Application log |
| `Platform Worker` | Platform Worker | Application log |

---

## Viewing logs in Event Viewer (GUI)

1. Open **Event Viewer** (`eventvwr.msc`)
2. Navigate to **Windows Logs → Application**
3. In the **Actions** pane, click **Filter Current Log...**
4. In **Event sources**, type `Platform Web` or `Platform Worker`
5. Click OK

The filtered view shows only platform entries, sorted by time.

---

## Viewing logs via PowerShell

```powershell
# Last 50 entries from the web app
Get-EventLog -LogName Application -Source "Platform Web" -Newest 50

# Errors only
Get-EventLog -LogName Application -Source "Platform Web" -EntryType Error -Newest 20

# Entries from the last hour
$since = (Get-Date).AddHours(-1)
Get-EventLog -LogName Application -Source "Platform Web" -After $since

# Format for readability
Get-EventLog -LogName Application -Source "Platform Web" -Newest 10 |
  Format-Table TimeGenerated, EntryType, Message -Wrap
```

---

## Event log entry types

| Type        | Meaning                                                   |
| ----------- | --------------------------------------------------------- |
| Information | Normal startup, shutdown, heartbeat                       |
| Warning     | Recoverable issues (e.g., slow DB query, retry succeeded) |
| Error       | Failures that may affect users                            |

node-windows writes Node process stdout as **Information** and stderr as **Error**.

---

## Correlating with file logs

The Node process also writes structured JSON logs to file. For a specific time range, cross-reference:

```powershell
# Find file log entries around the same time as an Event Log error
$errorTime = (Get-EventLog -LogName Application -Source "Platform Web" -EntryType Error -Newest 1).TimeGenerated
Get-Content C:\Platform\logs\web\current.log |
  Where-Object { $_ -match $errorTime.ToString("HH:mm") } |
  Select-Object -Last 30
```

---

## Event Log source registration

If the Event Log source is missing (service was manually removed and reinstalled), re-register:

```powershell
New-EventLog -LogName Application -Source "Platform Web"
New-EventLog -LogName Application -Source "Platform Worker"
```

If the sources already exist, this is a no-op. Verify with:

```powershell
[System.Diagnostics.EventLog]::SourceExists("Platform Web")
```

---

## Clearing old entries

The Application log can fill up on busy servers. Set a size limit via Group Policy or:

```powershell
Limit-EventLog -LogName Application -MaximumSize 100MB -OverflowAction OverwriteAsNeeded
```

This does not affect the file-based JSON logs, which rotate independently.

---

## Exporting logs for support

To capture recent platform events for a support ticket:

```powershell
$events = Get-EventLog -LogName Application -Source "Platform Web","Platform Worker" -Newest 500
$events | Export-Csv -Path C:\Temp\platform-events.csv -NoTypeInformation
```
