/**
 * Orchestration Engine — Extracted from HelpyBot
 * Standalone (no NestJS DI) multi-agent DAG workflow engine
 * with retry + circuit breaker resilience.
 */

import { logger } from "../utils/logger";

// ─── Domain Models ──────────────────────────────────────────

export interface AgentContext {
  workflowRunId: string;
  message: string;
  metadata: Record<string, unknown>;
  previousResults: Record<string, AgentResult>;
}

export interface AgentResult {
  agentName: string;
  success: boolean;
  data: unknown;
  confidence?: number;
  durationMs: number;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface IAgent {
  readonly name: string;
  readonly capabilities: string[];
  canHandle(context: AgentContext): boolean;
  execute(context: AgentContext): Promise<AgentResult>;
}

// ─── Workflow Definition ────────────────────────────────────

export interface WorkflowStepDef {
  stepId: string;
  agentName: string;
  dependsOn: string[];
}

export interface WorkflowDef {
  name: string;
  steps: WorkflowStepDef[];
}

export enum WorkflowRunStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
}

// ─── Workflow Event ─────────────────────────────────────────

export interface WorkflowEvent {
  eventId: string;
  timestamp: Date;
  workflowRunId: string;
  type: string;
  payload: unknown;
}

export type EventHandler = (event: WorkflowEvent) => void;

// ─── Event Bus (In-Memory) ──────────────────────────────────

export class EventBus {
  private handlers: EventHandler[] = [];

  subscribe(handler: EventHandler): void {
    this.handlers.push(handler);
  }

  async publish(event: WorkflowEvent): Promise<void> {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch {
        // Non-blocking: event handlers should not break the workflow
      }
    }
  }
}

// ─── Agent Registry ─────────────────────────────────────────

export class AgentRegistry {
  private readonly agents = new Map<string, IAgent>();

  register(agent: IAgent): void {
    if (this.agents.has(agent.name)) {
      logger.warn("REGISTRY", `Agent ${agent.name} already registered, overwriting.`);
    }
    this.agents.set(agent.name, agent);
    logger.info("REGISTRY", `Registered agent: ${agent.name}`);
  }

  get(name: string): IAgent {
    const agent = this.agents.get(name);
    if (!agent) {
      throw new Error(`Agent "${name}" not found in registry`);
    }
    return agent;
  }

  listAll(): IAgent[] {
    return Array.from(this.agents.values());
  }
}

// ─── Resilience Service ─────────────────────────────────────

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
}

export class ResilienceService {
  private failureCounts = new Map<string, number>();
  private lastFailureTimes = new Map<string, number>();

  async executeWithResilience<T>(
    operationName: string,
    operation: () => Promise<T>,
    retryOptions: RetryOptions = { maxRetries: 2, baseDelayMs: 500 },
    failureThreshold = 5,
    resetTimeoutMs = 30_000,
  ): Promise<T> {
    // Circuit Breaker check
    const failures = this.failureCounts.get(operationName) ?? 0;
    const lastFailure = this.lastFailureTimes.get(operationName) ?? 0;
    const now = Date.now();

    if (failures >= failureThreshold) {
      if (now - lastFailure < resetTimeoutMs) {
        logger.error("CIRCUIT", `Circuit OPEN for ${operationName} — failing fast`);
        throw new Error(`CircuitBreakerOpen: ${operationName}`);
      } else {
        logger.warn("CIRCUIT", `Circuit HALF-OPEN for ${operationName} — retrying`);
        this.failureCounts.set(operationName, 0);
      }
    }

    // Retry loop
    let attempt = 0;
    while (attempt <= retryOptions.maxRetries) {
      try {
        const result = await operation();
        if (this.failureCounts.get(operationName) !== 0) {
          this.failureCounts.set(operationName, 0);
        }
        return result;
      } catch (error: unknown) {
        attempt++;
        if (attempt > retryOptions.maxRetries) {
          const current = (this.failureCounts.get(operationName) ?? 0) + 1;
          this.failureCounts.set(operationName, current);
          this.lastFailureTimes.set(operationName, Date.now());
          logger.error("RETRY", `${operationName} failed after ${retryOptions.maxRetries} retries`);
          throw error;
        }
        const delay = retryOptions.baseDelayMs * Math.pow(2, attempt - 1);
        logger.warn("RETRY", `${operationName} failed. Retrying in ${delay}ms (${attempt}/${retryOptions.maxRetries})`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    throw new Error("Unreachable");
  }
}

// ─── Workflow Builder ───────────────────────────────────────

export class WorkflowBuilder {
  private steps: WorkflowStepDef[] = [];

  constructor(private readonly name: string) {}

  step(stepId: string, agentName: string, options?: { dependsOn?: string[] }): WorkflowBuilder {
    this.steps.push({
      stepId,
      agentName,
      dependsOn: options?.dependsOn ?? [],
    });
    return this;
  }

  build(): WorkflowDef {
    return { name: this.name, steps: [...this.steps] };
  }
}

// ─── Workflow Engine (DAG Executor) ─────────────────────────

export class WorkflowEngine {
  constructor(
    private readonly registry: AgentRegistry,
    private readonly resilience: ResilienceService,
    private readonly eventBus: EventBus,
  ) {}

  async executeWorkflow(workflow: WorkflowDef, runId: string, initialMessage: string): Promise<AgentContext> {
    logger.info("WORKFLOW", `Starting [${workflow.name}] run=${runId}`);

    await this.eventBus.publish({
      eventId: crypto.randomUUID(),
      timestamp: new Date(),
      workflowRunId: runId,
      type: "workflow.started",
      payload: { workflowName: workflow.name },
    });

    const context: AgentContext = {
      workflowRunId: runId,
      message: initialMessage,
      metadata: {},
      previousResults: {},
    };

    const completedSteps = new Set<string>();
    const failedSteps = new Set<string>();

    let progress = true;

    while (progress) {
      progress = false;

      const readySteps = workflow.steps.filter((step) => {
        if (completedSteps.has(step.stepId) || failedSteps.has(step.stepId)) return false;
        return step.dependsOn.every((dep) => completedSteps.has(dep));
      });

      if (readySteps.length === 0) break;
      progress = true;

      const stepPromises = readySteps.map(async (step) => {
        const agent = this.registry.get(step.agentName);
        const startTime = Date.now();

        await this.eventBus.publish({
          eventId: crypto.randomUUID(),
          timestamp: new Date(),
          workflowRunId: runId,
          type: "agent.started",
          payload: { agentName: agent.name, stepId: step.stepId },
        });

        try {
          if (!agent.canHandle(context)) {
            logger.debug("WORKFLOW", `Agent ${agent.name} skipping step ${step.stepId}`);
            completedSteps.add(step.stepId);
            return;
          }

          const result = await this.resilience.executeWithResilience(
            `agent:${agent.name}`,
            () => agent.execute(context),
          );

          if (result.success) {
            context.previousResults[step.stepId] = result;
            completedSteps.add(step.stepId);

            await this.eventBus.publish({
              eventId: crypto.randomUUID(),
              timestamp: new Date(),
              workflowRunId: runId,
              type: "agent.completed",
              payload: { agentName: agent.name, stepId: step.stepId, durationMs: Date.now() - startTime },
            });
          } else {
            failedSteps.add(step.stepId);
            await this.eventBus.publish({
              eventId: crypto.randomUUID(),
              timestamp: new Date(),
              workflowRunId: runId,
              type: "agent.failed",
              payload: { agentName: agent.name, stepId: step.stepId, error: result.error },
            });
          }
        } catch (error: unknown) {
          failedSteps.add(step.stepId);
          const errMsg = error instanceof Error ? error.message : "Unknown error";
          await this.eventBus.publish({
            eventId: crypto.randomUUID(),
            timestamp: new Date(),
            workflowRunId: runId,
            type: "agent.failed",
            payload: { agentName: agent.name, stepId: step.stepId, error: errMsg },
          });
        }
      });

      await Promise.all(stepPromises);
    }

    const status = failedSteps.size > 0 ? WorkflowRunStatus.FAILED : WorkflowRunStatus.COMPLETED;

    await this.eventBus.publish({
      eventId: crypto.randomUUID(),
      timestamp: new Date(),
      workflowRunId: runId,
      type: `workflow.${status}`,
      payload: {
        workflowName: workflow.name,
        completedSteps: Array.from(completedSteps),
        failedSteps: Array.from(failedSteps),
      },
    });

    logger.info("WORKFLOW", `[${workflow.name}] finished: ${status} (${completedSteps.size} ok, ${failedSteps.size} failed)`);
    return context;
  }
}
