# Progress Monitoring Pattern for OpEncoder Agent

## The Problem

The `opencoder` agent delegates work via the `Task` tool but doesn't monitor progress, causing it to appear to "stop" after tool execution. The CodeNomad system supports progress tracking via task frontmatter fields (`progress_stage`, `progress_message`, `progress_pct`), but there's no monitoring loop.

## The Solution

After delegating a task, the opencoder agent must implement a **progress monitoring loop** that:

1. Creates the task for a sub-agent
2. Polls for progress updates via `list_tasks` or `read_task`
3. Waits for `progressStage` to become `"complete"` or `"error"`
4. Aggregates results and continues with the prompt

---

## Implementation Pattern

```typescript
// 1. DELEGATE: Create task for sub-agent
const createResult = await Task({
  subagent_type: "website-ui",
  description: "Design dashboard layout",
  prompt: `Design a dashboard page at tokenizmyapp/src/app/dashboard/page.tsx with:
   - MUI v9 Grid system
   - Top app bar with title "TokenizMyApp"
   - Sidebar navigation
   - Main content with welcome card
   - Theme provider integration
   - Server component fetching from /api/admin/tenants`
})

// 2. MONITOR: Progress tracking loop
let taskCompleted = false
let maxAttempts = 30
let attempt = 0

while (!taskCompleted && attempt < maxAttempts) {
  attempt++
  
  // Check task progress
  const tasks = await list_tasks()
  const myTask = tasks.find((t: any) => t.title && t.title.includes("dashboard layout"))
  
  if (myTask) {
    const progress = myTask.progressStage ? `[${myTask.progressStage}]` : ""
    const message = myTask.progressMessage || ""
    const pct = myTask.progressPct !== undefined ? `${myTask.progressPct}%` : ""
    
    console.log(`Task ${myTask.taskId} progress: ${progress} ${message} ${pct}`)
    
    // Check completion
    if (myTask.progressStage === "complete") {
      taskCompleted = true
      console.log("✅ Task completed successfully")
      
      // 3. AGGREGATE: Read results and continue
      const taskDetails = await read_task({ taskId: myTask.taskId })
      console.log("Task results:", taskDetails)
      
      // Continue with remaining prompt work
      // ... validate, integrate, proceed to next step
      
    } else if (myTask.progressStage === "error") {
      taskCompleted = true
      console.log("❌ Task failed:", myTask.progressMessage)
      // Handle error - may need to retry or abort
      
    } else if (myTask.progressStage === "tool_call" || myTask.progressStage === "executing") {
      // Still working, wait and check again
      await new Promise(resolve => setTimeout(resolve, 2000))
      
    } else {
      // Unknown stage, wait and retry
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  } else {
    // Task not yet visible, wait
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
}

// 4. VALIDATE: Run project checks after completion
if (taskCompleted) {
  // Run type-check and lint on modified files
  await run(`bun run type-check --workdir tokenizmyapp`)
  await run(`bun run lint --workdir tokenizmyapp`)
  
  // Report summary to user
  console.log("✅ Progress monitoring complete. Ready to continue with prompt.")
}
```

---

## Key Progress States

| `progressStage` | Meaning | Action |
|-----------------|---------|--------|
| `thinking` | Agent is planning/reasoning | Continue monitoring |
| `tool_call` | Agent is calling a tool | Continue monitoring |
| `tool_result` | Agent received tool results | Continue monitoring |
| `executing` | Agent is executing code | Continue monitoring |
| `reviewing` | Agent is reviewing its work | Continue monitoring |
| `complete` | Task finished successfully | Aggregate results, continue |
| `error` | Task failed | Handle error, abort or retry |

---

## Monitoring with `read_task`

For a specific task ID (e.g., `TASK-abc123` or the generated `t-dashboard-layout-1724067890123`):

```typescript
// Read current task status
const taskStatus = await read_task({ taskId: "t-dashboard-layout-1724067890123" })

// Example output format:
// ## Task: t-dashboard-layout-1724067890123
// **Status:** pending
// **Agent:** website-ui
// **Title:** Design dashboard layout
// **Progress:** —
// **Progress %:** —
// **Created:** 2026-08-18T...
// **Updated:** 2026-08-18T...
```

---

## Updating Progress (from sub-agent)

If the sub-agent needs to update progress (though typically the CodeNomad server watches for this):

```typescript
await update_task_progress({
  taskId: "t-dashboard-layout-1724067890123",
  stage: "tool_call",
  message: "Creating MUI Grid layout structure"
})
// Or with progress percentage:
await update_task_progress({
  taskId: "t-dashboard-layout-1724067890123",
  stage: "executing",
  message: "Rendering dashboard components",
  pct: 65
})
```

---

## Full Monitoring Loop Example

```typescript
async function monitorTaskProgress(taskId: string, timeoutMs = 60000) {
  const startTime = Date.now()
  let completed = false
  
  while (!completed && (Date.now() - startTime) < timeoutMs) {
    const tasks = await list_tasks()
    const task = tasks.find((t: any) => t.taskId === taskId)
    
    if (task) {
      console.log(`Progress [${task.progressStage || "—"}]: ${task.progressMessage || ""}`)
      
      if (task.progressStage === "complete") {
        console.log("✅ Task complete!")
        return await read_task({ taskId })
      }
      
      if (task.progressStage === "error") {
        console.log("❌ Task error:", task.progressMessage)
        throw new Error(task.progressMessage)
      }
    }
    
    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, 3000))
  }
  
  throw new Error(`Task ${taskId} did not complete within ${timeoutMs}ms`)
}
```

---

## Integration with Website Feature Workflow

The `website_feature` NomadWorks workflow already defines the proper step order:

```yaml
website_feature:
  steps:
    - agent: website-db
      task: Schema design + generation
    - agent: website-api
      task: API routes with auth + validation
    - agent: website-state
      task: RTK Query endpoints + slices
    - agent: website-ui
      task: MUI components
    - agent: website-nextjs
      task: Route integration + layout
    - agent: website-testing
      task: Test coverage
    - agent: website-deploy
      task: Deploy gate check
```

**The opencoder agent should:**
1. Execute each step sequentially
2. After each `Task({...})` call, run the progress monitoring loop
3. Only proceed to the next step after `progressStage === "complete"`
4. Run validation gates: `bun run type-check && bun run lint`
5. After all steps, run `bun run test` for test coverage

---

## Without Progress Monitoring (Current Issue)

```
opencoder receives task
  → Task({ subagent_type: "website-ui", ... })  // Delegates
  → [RETURNS]  // Opencoder stops here, never monitors!
  → [NEVER CONTINUES]  // User waits indefinitely
```

## With Progress Monitoring (Fixed)

```
opencoder receives task
  → Task({ subagent_type: "website-ui", ... })  // Delegates
  → monitorLoop()  // Polls progress every 2-3 seconds
  → ✅ progressStage === "complete"
  → aggregate results from read_task
  → ✅ validate with type-check/lint
  → ✅ continue with next task or report summary
```

---

## Summary

The **progress monitoring pattern** is essential for the opencoder agent to:

1. **Not appear to stop** after delegating work
2. **Wait for sub-agent completion** before aggregating results
3. **Handle errors** gracefully instead of failing silently
4. **Continue the workflow** only after tasks are done
5. **Validate code** after implementation (type-check, lint, test)

Without this pattern, the opencoder agent creates tasks but never aggregates results, causing the "stopping after tool executed" issue described by the user.