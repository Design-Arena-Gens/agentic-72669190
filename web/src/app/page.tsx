/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import type {
  AutomationConfig,
  AutomationFlow,
  AutomationResponse,
  MatchType,
} from "@/lib/types";
import { automationConfigSchema, serializeConfig } from "@/lib/automation";
import { defaultConfig } from "@/lib/defaultConfig";

const STORAGE_KEY = "flowwave:config:v1";

const matchTypeLabels: Record<MatchType, string> = {
  exact: "Exact match",
  contains: "Contains",
  starts_with: "Starts with",
  regex: "Regex",
};

const matchDescriptions: Record<MatchType, string> = {
  exact: "Matches the entire inbound message.",
  contains: "Triggers when the inbound message includes the phrase.",
  starts_with: "Triggers when the inbound message starts with the phrase.",
  regex: "Advanced matching using regular expressions.",
};

export default function Home() {
  const [config, setConfig] = useState<AutomationConfig>(defaultConfig);
  const [selectedFlowId, setSelectedFlowId] = useState<string>(defaultConfig.flows[0]?.id ?? "");
  const [testMessage, setTestMessage] = useState("hey I need support");
  const [simulationResult, setSimulationResult] = useState<{
    twiml: string;
    flow?: AutomationFlow | null;
  } | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const selectedFlow = useMemo(
    () => config.flows.find((flow) => flow.id === selectedFlowId) ?? null,
    [config.flows, selectedFlowId]
  );

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      const safeConfig = automationConfigSchema.parse(parsed);
      setConfig(safeConfig);
      setSelectedFlowId(safeConfig.flows[0]?.id ?? "");
    } catch (error) {
      console.warn("Failed to hydrate automation config from storage.", error);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, serializeConfig(config));
  }, [config]);

  const handleAddFlow = () => {
    const newFlow: AutomationFlow = {
      id: crypto.randomUUID(),
      name: "Untitled flow",
      description: "Describe what this flow automates.",
      matchType: "contains",
      matchValue: "keyword",
      tags: [],
      active: true,
      responses: [
        {
          id: crypto.randomUUID(),
          label: "Auto reply",
          message: "Thanks for reaching out! How can we help you today?",
        },
      ],
    };
    setConfig((prev) => ({
      ...prev,
      flows: [newFlow, ...prev.flows],
    }));
    setSelectedFlowId(newFlow.id);
  };

  const handleCloneFlow = (flow: AutomationFlow) => {
    const cloned: AutomationFlow = {
      ...flow,
      id: crypto.randomUUID(),
      name: `${flow.name} (copy)`,
      responses: flow.responses.map((response) => ({
        ...response,
        id: crypto.randomUUID(),
      })),
    };
    setConfig((prev) => ({
      ...prev,
      flows: [cloned, ...prev.flows],
    }));
    setSelectedFlowId(cloned.id);
  };

  const handleDeleteFlow = (id: string) => {
    setConfig((prev) => {
      const nextFlows = prev.flows.filter((flow) => flow.id !== id);
      if (selectedFlowId === id) {
        setSelectedFlowId(nextFlows[0]?.id ?? "");
      }
      return {
        ...prev,
        flows: nextFlows,
      };
    });
  };

  const updateFlow = (id: string, patch: Partial<AutomationFlow>) => {
    setConfig((prev) => ({
      ...prev,
      flows: prev.flows.map((flow) =>
        flow.id === id
          ? {
              ...flow,
              ...patch,
            }
          : flow
      ),
    }));
  };

  const updateResponse = (
    flowId: string,
    responseId: string,
    patch: Partial<AutomationResponse>
  ) => {
    setConfig((prev) => ({
      ...prev,
      flows: prev.flows.map((flow) =>
        flow.id === flowId
          ? {
              ...flow,
              responses: flow.responses.map((response) =>
                response.id === responseId
                  ? {
                      ...response,
                      ...patch,
                    }
                  : response
              ),
            }
          : flow
      ),
    }));
  };

  const addResponse = (flowId: string) => {
    const nextResponse: AutomationResponse = {
      id: crypto.randomUUID(),
      label: "Follow-up",
      message: "Adding human context here…",
      mediaUrls: [],
    };
    setConfig((prev) => ({
      ...prev,
      flows: prev.flows.map((flow) =>
        flow.id === flowId
          ? {
              ...flow,
              responses: [...flow.responses, nextResponse],
            }
          : flow
      ),
    }));
  };

  const removeResponse = (flowId: string, responseId: string) => {
    setConfig((prev) => ({
      ...prev,
      flows: prev.flows.map((flow) =>
        flow.id === flowId
          ? {
              ...flow,
              responses: flow.responses.filter((response) => response.id !== responseId),
            }
          : flow
      ),
    }));
  };

  const handleCopyConfig = async () => {
    const json = serializeConfig(config);
    try {
      await navigator.clipboard.writeText(json);
    } catch (error) {
      console.error("Clipboard permissions missing. Fallback to download.", error);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "automation-config.json";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const runSimulation = async () => {
    if (!testMessage.trim()) return;
    setIsSimulating(true);
    setSimulationError(null);
    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...config,
          message: testMessage,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error ?? "Simulation failed");
      }

      const payload = (await response.json()) as {
        twiml: string;
        flow?: AutomationFlow | null;
      };
      setSimulationResult(payload);
    } catch (error) {
      setSimulationError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.badge}>FlowWave Automation</span>
          <h1>Launch a conversational WhatsApp agent in minutes.</h1>
          <p>
            Craft intelligent automations, simulate Twilio webhooks, and deploy straight to
            Vercel. FlowWave keeps your team in the loop while delivering instant answers 24/7.
          </p>
          <div className={styles.heroActions}>
            <button className={styles.primaryCta} type="button" onClick={handleAddFlow}>
              Create flow
            </button>
            <Link className={styles.secondaryCta} href="#deployment">
              Deployment guide
            </Link>
          </div>
          <div className={styles.metrics}>
            <MetricCard label="Median response time" value="1.2s" />
            <MetricCard label="Automated coverage" value="87%" />
            <MetricCard label="Agent handoffs" value="12% / week" />
          </div>
        </div>
        <div className={styles.heroPreview}>
          <div className={styles.deviceMock}>
            <div className={styles.deviceHeader}>
              <img src="/logo.svg" alt="FlowWave mark" className={styles.deviceLogo} />
              <div>
                <strong>FlowWave Agent</strong>
                <p>Typically replies instantly</p>
              </div>
            </div>
            <div className={styles.deviceMessages}>
              <span className={styles.agentBubble}>
                Hey! Looking for pricing, support, or to book a demo? I can help.
              </span>
              <span className={styles.customerBubble}>Need support, system is down!</span>
              <span className={styles.agentBubble}>
                I&apos;m escalating you to the on-call engineer. You&apos;ll hear from Alex in a
                moment.
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.builderSection} id="builder">
          <div className={styles.sectionHeader}>
            <div>
              <h2>Automation designer</h2>
              <p>
                Define triggers, craft responses, and preview the Twilio webhook payload without
                leaving the browser.
              </p>
            </div>
            <div className={styles.sectionActions}>
              <button type="button" className={styles.secondaryButton} onClick={handleCopyConfig}>
                Copy JSON for env
              </button>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  setConfig(defaultConfig);
                  setSelectedFlowId(defaultConfig.flows[0]?.id ?? "");
                }}
              >
                Reset defaults
              </button>
            </div>
          </div>

          <div className={styles.builderGrid}>
            <aside className={styles.flowColumn}>
              <div className={styles.flowColumnHeader}>
                <h3>Flows</h3>
                <button type="button" onClick={handleAddFlow}>
                  +
                </button>
              </div>
              <ul className={styles.flowList}>
                {config.flows.map((flow) => (
                  <li
                    key={flow.id}
                    className={`${styles.flowItem} ${
                      flow.id === selectedFlowId ? styles.flowItemActive : ""
                    }`}
                  >
                    <button type="button" onClick={() => setSelectedFlowId(flow.id)}>
                      <div>
                        <strong>{flow.name}</strong>
                        <p>{flow.description}</p>
                      </div>
                      <span className={flow.active ? styles.statusActive : styles.statusPaused}>
                        {flow.active ? "Active" : "Paused"}
                      </span>
                    </button>
                    <div className={styles.flowItemActions}>
                      <button type="button" onClick={() => handleCloneFlow(flow)}>
                        Duplicate
                      </button>
                      <button type="button" onClick={() => handleDeleteFlow(flow.id)}>
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </aside>

            {selectedFlow && (
              <section className={styles.flowEditor}>
                <header className={styles.flowEditorHeader}>
                  <div>
                    <h3>{selectedFlow.name}</h3>
                    <p>{selectedFlow.description}</p>
                  </div>
                  <label className={styles.toggle}>
                    <input
                      type="checkbox"
                      checked={selectedFlow.active}
                      onChange={(event) =>
                        updateFlow(selectedFlow.id, { active: event.target.checked })
                      }
                    />
                    <span>Enabled</span>
                  </label>
                </header>

                <div className={styles.fieldGroup}>
                  <label htmlFor="flow-name">Flow name</label>
                  <input
                    id="flow-name"
                    value={selectedFlow.name}
                    onChange={(event) => updateFlow(selectedFlow.id, { name: event.target.value })}
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label htmlFor="flow-description">Description</label>
                  <textarea
                    id="flow-description"
                    rows={2}
                    value={selectedFlow.description ?? ""}
                    onChange={(event) =>
                      updateFlow(selectedFlow.id, { description: event.target.value })
                    }
                  />
                </div>

                <div className={styles.fieldGrid}>
                  <div>
                    <label htmlFor="match-type">Match type</label>
                    <select
                      id="match-type"
                      value={selectedFlow.matchType}
                      onChange={(event) =>
                        updateFlow(selectedFlow.id, {
                          matchType: event.target.value as MatchType,
                        })
                      }
                    >
                      {Object.entries(matchTypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <p className={styles.helper}>{matchDescriptions[selectedFlow.matchType]}</p>
                  </div>

                  <div>
                    <label htmlFor="match-value">Match value</label>
                    <input
                      id="match-value"
                      value={selectedFlow.matchValue}
                      onChange={(event) =>
                        updateFlow(selectedFlow.id, { matchValue: event.target.value })
                      }
                    />
                    {selectedFlow.matchType === "regex" && (
                      <p className={styles.helper}>
                        Provide a valid JavaScript regular expression without delimiters.
                      </p>
                    )}
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label htmlFor="flow-tags">Tags</label>
                  <input
                    id="flow-tags"
                    value={(selectedFlow.tags ?? []).join(", ")}
                    onChange={(event) =>
                      updateFlow(selectedFlow.id, {
                        tags: event.target.value
                          .split(",")
                          .map((tag) => tag.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="support, onboarding, vip"
                  />
                </div>

                <section className={styles.responsesSection}>
                  <header>
                    <h4>Responses</h4>
                    <button type="button" onClick={() => addResponse(selectedFlow.id)}>
                      Add message
                    </button>
                  </header>
                  <div className={styles.responsesGrid}>
                    {selectedFlow.responses.map((response, index) => (
                      <article key={response.id} className={styles.responseCard}>
                        <header>
                          <span className={styles.responseIndex}>#{index + 1}</span>
                          <input
                            value={response.label ?? ""}
                            onChange={(event) =>
                              updateResponse(selectedFlow.id, response.id, {
                                label: event.target.value,
                              })
                            }
                            placeholder="Label"
                          />
                          <button
                            type="button"
                            onClick={() => removeResponse(selectedFlow.id, response.id)}
                          >
                            Remove
                          </button>
                        </header>
                        <label>
                          <span>Message</span>
                          <textarea
                            rows={3}
                            value={response.message}
                            onChange={(event) =>
                              updateResponse(selectedFlow.id, response.id, {
                                message: event.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          <span>Media URLs (comma separated)</span>
                          <input
                            value={(response.mediaUrls ?? []).join(", ")}
                            onChange={(event) =>
                              updateResponse(selectedFlow.id, response.id, {
                                mediaUrls: event.target.value
                                  .split(",")
                                  .map((value) => value.trim())
                                  .filter(Boolean),
                              })
                            }
                            placeholder="https://example.com/brochure.pdf"
                          />
                        </label>
                        <label>
                          <span>Handoff to agent (WhatsApp number)</span>
                          <input
                            value={response.handoffNumber ?? ""}
                            onChange={(event) =>
                              updateResponse(selectedFlow.id, response.id, {
                                handoffNumber: event.target.value,
                              })
                            }
                            placeholder="+15555550123"
                          />
                        </label>
                      </article>
                    ))}
                  </div>
                </section>
              </section>
            )}

            <section className={styles.simulator}>
              <h3>Twilio webhook simulator</h3>
              <p>
                Run the webhook logic locally by sending a mock inbound message. The response is
                rendered as TwiML exactly as Twilio will receive it.
              </p>
              <label>
                <span>Sample inbound message</span>
                <textarea
                  rows={3}
                  value={testMessage}
                  onChange={(event) => setTestMessage(event.target.value)}
                />
              </label>
              <button
                type="button"
                className={styles.primaryCta}
                onClick={runSimulation}
                disabled={isSimulating}
              >
                {isSimulating ? "Running…" : "Simulate webhook"}
              </button>

              {simulationError && <p className={styles.error}>{simulationError}</p>}
              {simulationResult && (
                <div className={styles.simulationResult}>
                  <h4>{simulationResult.flow ? simulationResult.flow.name : "Fallback"}</h4>
                  <code>{simulationResult.twiml}</code>
                  {simulationResult.flow?.responses.map((response) => (
                    <div key={response.id} className={styles.simulationResponse}>
                      <strong>{response.label ?? "Message"}</strong>
                      <p>{response.message}</p>
                      {response.mediaUrls && response.mediaUrls.length > 0 && (
                        <ul>
                          {response.mediaUrls.map((url) => (
                            <li key={url}>
                              <a href={url} target="_blank" rel="noreferrer">
                                {url}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </section>

        <section className={styles.guideSection} id="deployment">
          <h2>Wire it up to Twilio & Vercel</h2>
          <div className={styles.guideGrid}>
            <article>
              <h3>1. Provision WhatsApp</h3>
              <ul>
                <li>Enable the WhatsApp sandbox or your Business profile in Twilio.</li>
                <li>Note your <code>ACCOUNT_SID</code>, <code>AUTH_TOKEN</code>, and sender number.</li>
                <li>Set the incoming webhook URL to <code>/api/webhook</code> once deployed.</li>
              </ul>
            </article>
            <article>
              <h3>2. Configure automation</h3>
              <ul>
                <li>Use “Copy JSON for env” to populate the <code>AUTOMATION_RULES</code> variable.</li>
                <li>
                  Export other settings: <code>TWILIO_ACCOUNT_SID</code>, <code>TWILIO_AUTH_TOKEN</code>, and{" "}
                  <code>TWILIO_WHATSAPP_NUMBER</code>.
                </li>
                <li>Commit changes and deploy with the bundled Vercel command.</li>
              </ul>
            </article>
            <article>
              <h3>3. Monitor & iterate</h3>
              <ul>
                <li>Use the simulator before shipping new flows.</li>
                <li>Pair with Twilio Conversations or Flex for agent collaboration.</li>
                <li>Iterate safely—FlowWave keeps a local snapshot in your browser.</li>
              </ul>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metricCard}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
