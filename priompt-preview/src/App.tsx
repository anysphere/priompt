import { useState, useEffect, useCallback, useRef } from "react";
import { Prompt } from "priompt";
import { streamChat } from "./openai";
import { useDebouncedCallback as useDebouncedCallback2 } from "use-debounce";
import { ChatAndFunctionPromptFunction } from "priompt/dist/types";
import { ChatCompletionResponseMessage } from "./openai_interfaces";

function useDebouncedCallback<T extends (...args: A[]) => R, A, R>(
  callback: T,
  delay: number
): T {
  const callbackRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  ) as T;
}

// Usage example:
const App = () => {
  const [selectedPrompt, setSelectedPrompt] = useState("");
  const [selectedPropsId, setSelectedPropsId] = useState("");
  const [tokenCount, setTokenCount] = useState(8192);
  const [derivedTokenCount, setDerivedTokenCount] = useState(8192);
  const [tokenCountUsed, setTokenCountUsed] = useState(0);
  const [tokenCountReserved, setTokenCountReserved] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [priorityCutoff, setPriorityCutoff] = useState<number | undefined>(
    undefined
  );
  const [promptsls, setPromptsls] = useState<string[]>([]);
  const [prompt, setPrompt] = useState<Prompt | undefined>(undefined);
  const [prompts, setPrompts] = useState<
    Record<
      string,
      {
        dumps: string[];
        saved: string[];
      }
    >
  >({});

  const textAreaRefs = useRef<Array<HTMLTextAreaElement | undefined>>(
    Array.from({ length: 1 }).map(() => undefined)
  );
  const [errorMessage, setErrorMessage] = useState<string>("");

  const [fullPrompts, setFullPrompts] = useState<
    | {
        prompt: Prompt;
        texts: string[];
        functions: ChatAndFunctionPromptFunction[];
      }
    | undefined
  >(undefined);

  console.log("New Change!");

  const [completion, setCompletion] = useState<
    ChatCompletionResponseMessage | undefined
  >(undefined);
  const [loadingCompletion, setLoadingCompletion] = useState<boolean>(false);

  const [abortController, setAbortController] = useState<
    AbortController | undefined
  >(undefined);
  const [forceRerender, setForceRerender] = useState<number>(0);

  useEffect(() => {
    const storedSelectedPrompt = localStorage.getItem("selectedPrompt");
    const storedSelectedPropsId = localStorage.getItem("selectedPropsId");

    console.log(
      "FETCHING PROMPTS!",
      storedSelectedPrompt,
      storedSelectedPropsId
    );

    fetch(`http://localhost:3000/priompt/getPreviews`)
      .then((response) => response.json())
      .then((data) => {
        console.log("GOT RESPONSE", data);
        setPrompts(data);
        const x = Object.keys(data);
        setPromptsls(x);

        if (storedSelectedPrompt === "liveModePromptId") {
          setSelectedPrompt(storedSelectedPrompt);
          setSelectedPropsId(storedSelectedPropsId ?? "");
          return;
        }

        let ix = 0;
        if (storedSelectedPrompt && x.includes(storedSelectedPrompt)) {
          setSelectedPrompt(storedSelectedPrompt);
          ix = x.indexOf(storedSelectedPrompt);
        } else {
          setSelectedPrompt(x[ix]);
        }
        console.log("ix", ix);
        console.log("x", x);
        console.log("dumps", data[x[ix]].dumps);
        if (
          storedSelectedPropsId &&
          data[x[ix]].saved.includes(storedSelectedPropsId)
        ) {
          setSelectedPropsId(storedSelectedPropsId);
        } else if (
          storedSelectedPropsId &&
          data[x[ix]].dumps.includes(storedSelectedPropsId)
        ) {
          console.log("setting selected props id", storedSelectedPropsId);
          setSelectedPropsId(storedSelectedPropsId);
        } else {
          setSelectedPropsId(data[x[ix]].saved[0] ?? data[x[ix]].dumps[0]);
        }
      });
  }, []);

  useEffect(() => {
    if (prompt === undefined) {
      return;
    } else {
      if (typeof prompt === "string") {
        setFullPrompts({
          prompt: prompt,
          texts: [prompt],
          functions: [],
        });
      } else if (prompt.type === "text") {
        setFullPrompts({
          prompt: prompt,
          texts: [prompt.text],
          functions: prompt.functions,
        });
      } else {
        setFullPrompts({
          prompt: prompt,
          texts: prompt.messages.map((message) => message.content ?? ""),
          functions: "functions" in prompt ? prompt.functions : [],
        });
      }
    }
  }, [prompt]);

  const debouncedSetFullPrompts = useDebouncedCallback2(
    (i: number, value: string) => {
      setFullPrompts((prev) => {
        if (prev === undefined) {
          return undefined;
        }
        const newTexts = [...prev.texts];
        newTexts[i] = value;

        return {
          prompt: prev.prompt,
          texts: newTexts,
          functions: prev.functions,
        };
      });
    },
    100 // debounce delay in milliseconds
  );

  const fetchPrompt = useCallback(
    (promptId: string, propsId: string, tokenCount: number) => {
      console.log("fetching prompt", promptId, propsId, tokenCount);
      const query = {
        promptId,
        propsId,
        tokenLimit: tokenCount.toString(),
      };

      if (promptId === "liveModePromptId" && propsId === "") {
        setErrorMessage("waiting for live mode prompt...");
        setPrompt(undefined);
        setCompletion(undefined);
        return;
      }

      console.log("FETCHING PROMPT!");

      fetch(
        `http://localhost:3000/priompt/getPrompt?${new URLSearchParams(query)}`
      )
        .then((response) => {
          if (!response.ok) {
            throw new Error("Error fetching prompt: " + response.statusText);
          }
          return response.json();
        })
        .then((data) => {
          setTokenCountUsed(data.tokenCount);
          setTokenCountReserved(data.tokensReserved);
          setDurationMs(data.durationMs);
          setPriorityCutoff(data.priorityCutoff);
          setPrompt(data.prompt);
          setErrorMessage("");
          setCompletion(undefined);
        })
        .catch((error) => {
          setErrorMessage(error.message);
          setPrompt(undefined);
          setCompletion(undefined);
        });
    },
    []
  );

  useEffect(() => {
    if (selectedPrompt) {
      console.log("FETCHING PROMPT IN 156 use effect");
      fetchPrompt(selectedPrompt, selectedPropsId, derivedTokenCount);
    }
  }, [selectedPrompt, fetchPrompt, selectedPropsId, derivedTokenCount]);

  // Add event listener for keydown events
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      // console.log(event._stopPropagation);
      // If the textarea is focused, stop propagation of the event
      if (
        document.activeElement?.id &&
        document.activeElement.id.includes("prompt-textarea")
      ) {
        return;
      }

      // Press "r" to reload (fetchPrompt again)
      if (key === "r") {
        fetchPrompt(selectedPrompt, selectedPropsId, tokenCount);
      }

      const slider = document.getElementById(
        "token-count-slider"
      ) as HTMLInputElement;

      // Press shift-left and shift-right arrows to advance the slider by 128
      const shiftStep = 128;
      if (event.shiftKey && key === "ArrowLeft") {
        slider.value = Math.max(
          parseInt(slider.value) - shiftStep,
          parseInt(slider.min)
        ).toString();
        setTokenCount(parseInt(slider.value));
      } else if (event.shiftKey && key === "ArrowRight") {
        slider.value = Math.min(
          parseInt(slider.value) + shiftStep,
          parseInt(slider.max)
        ).toString();
        setTokenCount(parseInt(slider.value));
      }

      // Press left-right arrows to advance the slider left and right
      const step = 1; // Change this value to adjust the step size
      if (key === "ArrowLeft") {
        slider.value = Math.max(
          parseInt(slider.value) - step,
          parseInt(slider.min)
        ).toString();
        setTokenCount(parseInt(slider.value));
      } else if (key === "ArrowRight") {
        slider.value = Math.min(
          parseInt(slider.value) + step,
          parseInt(slider.max)
        ).toString();
        setTokenCount(parseInt(slider.value));
      }

      if (key >= "1" && key <= "9") {
        const digit = parseInt(key);
        const tokenCount = Math.round((digit * 1000) / 1024) * 1024;
        setTokenCount(tokenCount);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedPrompt, selectedPropsId, tokenCount, fetchPrompt]);

  const handleSelectPrompt = useCallback(
    (promptId: string) => {
      setSelectedPrompt(promptId);
      // Store the selected prompt and props id in localStorage
      if (promptId) {
        localStorage.setItem("selectedPrompt", promptId);
      }

      if (promptId !== "liveModePromptId") {
        const selectedProps =
          prompts[promptId].saved[0] ?? prompts[promptId].dumps[0];
        setSelectedPropsId(selectedProps);
        if (selectedProps) {
          localStorage.setItem("selectedPropsId", selectedProps);
        }
      } else {
        setSelectedPropsId("");
        localStorage.setItem("selectedPropsId", "");
      }
    },
    [prompts]
  );

  useEffect(() => {
    if (selectedPrompt !== "liveModePromptId") {
      return;
    }

    const query =
      selectedPropsId === ""
        ? undefined
        : {
            alreadySeenLiveModeId: selectedPropsId,
          };

    fetch(
      `http://localhost:3000/priompt/liveMode?${new URLSearchParams(query)}`
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error("Error fetching live mode: " + response.statusText);
        }
        return response.json();
      })
      .then((data) => {
        setSelectedPropsId(data.propsId);
        localStorage.setItem("selectedPropsId", data.propsId);
        setErrorMessage("");
        setCompletion(undefined);
      })
      .catch((error) => {
        setErrorMessage(error.message);
        setPrompt(undefined);
        setCompletion(undefined);
      });
  }, [selectedPrompt, selectedPropsId]);

  const debouncedSetTokenCount = useDebouncedCallback<
    (value: number) => void,
    number,
    void
  >((value: number) => setDerivedTokenCount(value), 30);

  useEffect(() => {
    debouncedSetTokenCount(tokenCount);
  }, [tokenCount, debouncedSetTokenCount]);

  const handleTokenCountChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = parseInt(event.target.value);
    setTokenCount(value);
  };

  const liveModeTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const streamCompletion = useCallback(
    async (model: string) => {
      if (!prompt) {
        alert("please select a prompt");
        return;
      }

      if (typeof prompt === "string" || prompt.type !== "chat") {
        alert("we only support chat prompts for now in the playground");
        return;
      }
      setCompletion(undefined);
      setLoadingCompletion(true);

      const abort = new AbortController();
      setAbortController(abort);

      try {
        const functions = fullPrompts?.functions ?? [];
        const stream = streamChat(
          {
            model,
            messages: prompt.messages.map((m, i) => {
              let content: string;
              if (fullPrompts?.texts[i] !== undefined) {
                content = fullPrompts.texts[i];
              } else {
                content = m.content ?? "";
              }

              if (m.role === "function") {
                return {
                  role: m.role,
                  name: m.name,
                  content,
                };
              } else if (m.role === "assistant" && m.functionCall) {
                return {
                  role: m.role,
                  function_call: m.functionCall,
                  content,
                };
              } else {
                return {
                  role: m.role,
                  content: content,
                };
              }
            }),
            temperature: 0,
            functions: functions.length > 0 ? functions : undefined,
          },
          undefined,
          abort.signal
        );

        for await (const message of stream) {
          setLoadingCompletion(false);
          console.log(message);
          const text = message.choices[0].delta?.content;
          const function_call = message.choices[0].delta?.function_call;
          setCompletion((c) => {
            return {
              ...c,
              role: "assistant",
              content:
                text !== undefined || c?.content !== undefined
                  ? (c?.content ?? "") + (text ?? "")
                  : undefined,
              function_call:
                c?.function_call !== undefined || function_call !== undefined
                  ? {
                      name:
                        (c?.function_call?.name ?? "") +
                        (function_call?.name ?? ""),
                      arguments:
                        (c?.function_call?.arguments ?? "") +
                        (function_call?.arguments ?? ""),
                    }
                  : undefined,
            };
          });
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          console.error(e);
          console.log(e);
          alert(`Error: ${(e as Error).message}`);
        }
      } finally {
        setAbortController(undefined);
        setLoadingCompletion(false);
      }
    },
    [prompt, fullPrompts]
  );

  useEffect(() => {
    if (prompt) {
      if (
        typeof prompt !== "string" &&
        prompt !== undefined &&
        prompt.type === "chat"
      ) {
        if (prompt.messages.length > textAreaRefs.current.length) {
          console.log("resizing textAreaRefs");
          textAreaRefs.current = Array.from({
            length: prompt.messages.length,
          }).map(() => undefined);
          // now we need to update the refs
          // force a re-render
          setForceRerender((x) => x + 1);
          return;
        }
      }
      textAreaRefs.current.map((r, i) => {
        if (r) {
          if (
            typeof prompt !== "string" &&
            prompt !== undefined &&
            prompt.type === "chat"
          ) {
            r.value = prompt.messages[i].content ?? "";
          }
          fixTextareaHeight(r);
        }
      });
    }
  }, [prompt]);

  return (
    <div>
      <h1>Welcome to Priompt</h1>
      <div>
        <b>r</b> to reload, <b>left</b> and <b>right</b> arrows to adjust token
        count, <b>shift-left</b> and <b>shift-right</b> arrows to adjust token
        count by 128
      </div>
      <br />
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          flexDirection: "row",
          gap: "10px",
          maxWidth: "100%",
          overflowX: "auto",
        }}
      >
        <div
          className="tab"
          onClick={() => handleSelectPrompt("liveModePromptId")}
          style={{
            border:
              "liveModePromptId" === selectedPrompt
                ? "1px solid black"
                : "none",
            cursor: "pointer",
          }}
        >
          live mode
        </div>
        {promptsls.map((prompt) => (
          <div
            key={prompt}
            className="tab"
            onClick={() => handleSelectPrompt(prompt)}
            style={{
              border: prompt === selectedPrompt ? "1px solid black" : "none",
              cursor: "pointer",
            }}
          >
            {prompt}
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          maxWidth: "100%",
          overflowX: "auto",
        }}
        // onWheel={(e) => {
        //   e.stopPropagation();
        //   e.preventDefault();
        //   e.currentTarget.scrollLeft += e.deltaY;
        // }}
        // onMouseEnter={() => {
        //   document.body.style.overflowY = "hidden";
        // }}
        // onMouseLeave={() => {
        //   document.body.style.overflowY = "auto";
        // }}
      >
        {prompts[selectedPrompt]?.saved.map((saved) => (
          <div key={saved}>
            <button
              style={{
                backgroundColor: saved === selectedPropsId ? "red" : "white",
              }}
              onClick={() => {
                console.log("saved", saved);
                setSelectedPropsId(saved);

                // Store the selected props id in localStorage
                localStorage.setItem("selectedPropsId", saved);
              }}
            >
              {saved}
            </button>
          </div>
        ))}
        {prompts[selectedPrompt]?.dumps
          .sort((a, b) => b.localeCompare(a))
          .map((dump) => (
            <div key={dump}>
              <button
                style={{
                  backgroundColor: dump === selectedPropsId ? "red" : "white",
                }}
                onClick={() => {
                  setSelectedPropsId(dump);

                  localStorage.setItem("selectedPropsId", dump);
                }}
              >
                {memoizedMakeDateNicer(dump)}
              </button>
            </div>
          ))}
      </div>
      <div>
        <label htmlFor="token-count-slider">
          Token count: <span>{tokenCount}</span>
        </label>
        <button onClick={() => setTokenCount(4096)}>4096 (press 4)</button>
        <button onClick={() => setTokenCount(8192)}>8192 (press 8)</button>
        <br />
        <input
          type="range"
          id="token-count-slider"
          min="1"
          max="32768"
          value={tokenCount}
          onChange={handleTokenCountChange}
          style={{
            width: "100%",
          }}
        />
      </div>
      <div>
        Used tokens: {tokenCountUsed} ({tokenCountReserved} reserved for
        generation, {priorityCutoff} cutoff)
      </div>
      <div>
        Render time: {durationMs}ms (don't trust too much because caching)
      </div>
      {errorMessage.length > 0 && (
        <>
          <div
            style={{
              backgroundColor: "rgba(255, 0, 0, 0.2)",
            }}
          >
            <b>Error:</b> {errorMessage}
          </div>
          <hr />
        </>
      )}
      <hr />
      <div id="prompt-display">
        {fullPrompts &&
          fullPrompts.functions.map((f) => (
            <div
              style={{
                backgroundColor: "rgba(150, 150, 10, 0.4)",
              }}
            >
              <b>function</b>
              <div
                style={{
                  border: "solid 1px rgba(0,0,0)",
                }}
              >
                <div>
                  <i>name:</i>
                  <div
                    style={{
                      border: "solid 1px rgba(0,0,0,0.2)",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {f.name}
                  </div>
                </div>
                <div>
                  <i>description:</i>
                  <div
                    style={{
                      border: "solid 1px rgba(0,0,0,0.2)",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {f.description}
                  </div>
                </div>
                <div>
                  <i>parameters:</i>
                  <div
                    style={{
                      border: "solid 1px rgba(0,0,0,0.2)",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {JSON.stringify(f.parameters, null, 2)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        {prompt &&
          (typeof prompt === "string" || prompt.type === "text" ? (
            <>{typeof prompt === "string" ? prompt : prompt.text}</>
          ) : (
            <>
              {prompt.messages.map((msg, i) => {
                return (
                  <div
                    style={{
                      backgroundColor:
                        msg.role === "user"
                          ? "rgba(0, 0, 255, 0.2)"
                          : msg.role === "assistant"
                          ? "rgba(0, 128, 0, 0.2)"
                          : msg.role === "system"
                          ? "rgba(100, 100, 100, 0.1)"
                          : "rgba(180,100,0,0.5)",
                      width: "100%",
                      // height: "fit-content",
                    }}
                  >
                    <b>{msg.role}</b>
                    {msg.role === "function" && <i>: {msg.name}</i>}
                    <br />
                    <textarea
                      ref={(el) => (textAreaRefs.current[i] = el ?? undefined)}
                      id={`prompt-textarea-${i}-${forceRerender}`}
                      style={{
                        whiteSpace: "pre-wrap",
                        width: "100%",
                        outline: "none",
                        resize: "none",
                        display: "block",
                        // remove the border from the textarea
                        border: "solid 1px",
                        // background completely transparent
                        backgroundColor: "rgba(0,0,0,0)",
                        boxSizing: "border-box",
                      }}
                      onKeyDown={(e) => {
                        // Capture all keydown events
                        e.stopPropagation();
                      }}
                      onChange={(e) => {
                        // Get the scroll height and adjust the height accordingly
                        fixTextareaHeight(e.target);
                        // console.log("CHANGING!", e);

                        const currentTextArea = textAreaRefs.current[i];
                        if (currentTextArea !== undefined) {
                          currentTextArea.value = e.target.value ?? "";
                        }
                        debouncedSetFullPrompts(i, e.target.value ?? "");
                      }}
                      // readOnly
                      // onChange={(e) => {

                      // }}>
                      // do not check spelling
                      spellCheck={false}
                    ></textarea>
                    {msg.role === "assistant" && msg.functionCall && (
                      <div
                        style={{
                          border: "solid 1px",
                          borderTop: "none",
                        }}
                      >
                        <i>calling function name:</i>
                        <div
                          style={{
                            whiteSpace: "pre-wrap",
                            border: "solid 1px rgba(0,0,0,0.1)",
                          }}
                        >
                          {msg.functionCall.name}
                        </div>
                        <i>arguments:</i>
                        <div
                          style={{
                            whiteSpace: "pre-wrap",
                            border: "solid 1px rgba(0,0,0,0.1)",
                          }}
                        >
                          {msg.functionCall.arguments}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          ))}
      </div>
      <div>
        <button onClick={() => streamCompletion("gpt-3.5-turbo")}>
          Submit to gpt-3.5
        </button>
        <button onClick={() => streamCompletion("gpt-3.5-turbo-0613")}>
          Submit to gpt-3.5-0613
        </button>
        <button onClick={() => streamCompletion("gpt-4")}>
          Submit to gpt-4
        </button>
        <button onClick={() => streamCompletion("gpt-4-0613")}>
          Submit to gpt-4-0613
        </button>
        <button onClick={() => streamCompletion("gpt-4-32k")}>
          Submit to gpt-4-32k
        </button>
        <button onClick={() => streamCompletion("gpt-4-32k-0613")}>
          Submit to gpt-4-32k-0613
        </button>
        {abortController !== undefined && (
          <>
            <button
              onClick={() => {
                abortController.abort();
                setAbortController(undefined);
              }}
            >
              Cancel
            </button>
          </>
        )}
      </div>
      {(completion !== undefined || loadingCompletion) && (
        <div
          style={{
            backgroundColor: "rgba(0,228,0,0.3)",
          }}
        >
          <b>assistant completion:</b>
          <div
            style={{
              whiteSpace: "pre-wrap",
              border: "solid 1px",
            }}
          >
            {loadingCompletion && <>loading...</>}
            <>{completion ? completion.content : ""}</>
          </div>
          {completion?.role === "assistant" && completion?.function_call && (
            <div
              style={{
                border: "solid 1px",
                borderTop: "none",
              }}
            >
              <i>calling function name:</i>
              <div
                style={{
                  whiteSpace: "pre-wrap",
                  border: "solid 1px rgba(0,0,0,0.1)",
                }}
              >
                {completion.function_call.name}
              </div>
              <i>arguments:</i>
              <div
                style={{
                  whiteSpace: "pre-wrap",
                  border: "solid 1px rgba(0,0,0,0.1)",
                }}
              >
                {completion.function_call.arguments}
              </div>
            </div>
          )}
        </div>
      )}
      {selectedPrompt === "liveModePromptId" && selectedPropsId !== "" && (
        <div>
          you are the LLM. the following is your response:
          <div>
            <textarea
              style={{
                whiteSpace: "pre-wrap",
                width: "100%",
                height: "300px",
                outline: "none",
                // remove the border from the textarea
                border: "solid 1px",
                // background completely transparent
                backgroundColor: "rgba(0,0,0,0)",
                boxSizing: "border-box",
              }}
              ref={liveModeTextareaRef}
            ></textarea>
          </div>
          <button
            onClick={() => {
              // submit to the server!
              const query = {
                output: liveModeTextareaRef.current?.value ?? "",
              };

              fetch(
                `http://localhost:3000/priompt/liveModeResult?${new URLSearchParams(
                  query
                )}`
              )
                .then((response) => {
                  if (!response.ok) {
                    throw new Error(
                      "Error submitting live mode result: " +
                        response.statusText
                    );
                  }
                  return response.json();
                })
                .then(() => {
                  setSelectedPropsId("");
                  setCompletion(undefined);
                  setPrompt(undefined);
                  setErrorMessage("waiting for live mode prompt...");
                })
                .catch((error) => {
                  setErrorMessage(error.message);
                  setPrompt(undefined);
                  setCompletion(undefined);
                });
            }}
          >
            send
          </button>
          {completion && (
            <button
              onClick={() => {
                // if completion is a function call, not supported yet
                if (completion.role === "function") {
                  alert(
                    "function calls not supported in priompt live mode yet"
                  );
                  return;
                }

                // submit to the server!
                const query = {
                  output: completion.content ?? "",
                };

                fetch(
                  `http://localhost:3000/priompt/liveModeResult?${new URLSearchParams(
                    query
                  )}`
                )
                  .then((response) => {
                    if (!response.ok) {
                      throw new Error(
                        "Error submitting live mode result: " +
                          response.statusText
                      );
                    }
                    return response.json();
                  })
                  .then(() => {
                    setSelectedPropsId("");
                    setCompletion(undefined);
                    setPrompt(undefined);
                    setErrorMessage("waiting for live mode prompt...");
                  })
                  .catch((error) => {
                    setErrorMessage(error.message);
                    setPrompt(undefined);
                    setCompletion(undefined);
                  });
              }}
            >
              send LLM response
            </button>
          )}
        </div>
      )}
      <div
        style={{
          height: "400px",
          opacity: 0,
        }}
      >
        {forceRerender}
      </div>
    </div>
  );
};

export default App;

function fixTextareaHeight(t: HTMLTextAreaElement) {
  t.style.height = "auto";
  const scrollHeight = t.scrollHeight + 2;
  t.style.height = scrollHeight + "px";
}

const memoizedMakeDateNicer = (() => {
  const cache = new Map();

  return (dump: string) => {
    if (cache.has(dump)) {
      return cache.get(dump);
    }

    const correctedDateString = dump
      .replace(/-/g, (match, offset) => (offset === 19 ? "." : match))
      .replace(/-/g, (match, offset) => (offset >= 11 ? ":" : match));

    const parsedDate = new Date(correctedDateString);
    const pstDate = new Date(parsedDate.getTime() - 7 * 60 * 60 * 1000);
    const formattedDate = pstDate.toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    cache.set(dump, formattedDate);
    return formattedDate;
  };
})();