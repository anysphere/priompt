import { useState, useEffect, useCallback, useRef } from "react";
import { Prompt } from "@anysphere/priompt";
import { streamChat } from "./openai";
import { useDebouncedCallback as useDebouncedCallback2 } from "use-debounce";
import { ChatAndFunctionPromptFunction } from "@anysphere/priompt";
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

const ALL_MODELS_STR = "gpt-3.5-turbo,gpt-4,gpt-4-32k";
const ALL_MODELS = ALL_MODELS_STR.split(",");

// Usage example:
const App = () => {
  console.log("RENDERING APP");
  const [timeToFirstToken, setTimeToFirstToken] = useState<number | null>();
  const [timeToRemainingTokens, setTimeToRemainingTokens] = useState<
    number | null
  >();
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
  const [output, setOutput] = useState<string | undefined>(undefined);

  const textAreaRefs = useRef<Array<HTMLTextAreaElement | undefined>>(
    Array.from({ length: 1 }).map(() => undefined)
  );
  const completionTextAreaRef = useRef<HTMLTextAreaElement | undefined>(
    undefined
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

  const [completion, setCompletion] = useState<
    ChatCompletionResponseMessage | undefined
  >(undefined);
  const [loadingCompletion, setLoadingCompletion] = useState<boolean>(false);

  const [abortController, setAbortController] = useState<
    AbortController | undefined
  >(undefined);
  const [forceRerender, setForceRerender] = useState<number>(0);

  const getPromptOutput = useCallback(
    (stream: boolean) => {
      // submit to the server!
      const query = {
        tokenLimit: tokenCount,
        promptId: selectedPrompt,
        propsId: selectedPropsId,
        completion: stream ? streamify(completion) : completion,
        stream,
      };

      fetch(
        `http://localhost:3000/priompt/getPromptOutput?${new URLSearchParams({
          v: JSON.stringify(query),
        })}`
      )
        .then((response) => {
          if (!response.ok) {
            throw new Error("Error getting output: " + response.statusText);
          }
          return response.json();
        })
        .then((r) => {
          console.log("got output", r);
          setOutput(JSON.stringify(r, null, 2));
          setErrorMessage("");
        })
        .catch((error) => {
          setErrorMessage(error.message);
          setOutput(undefined);
        });
    },
    [completion, selectedPrompt, selectedPropsId, tokenCount]
  );

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

  // Set a particular chat's data
  const debouncedSetFunctionData = useDebouncedCallback2(
    (functionIndex: number, data: ChatAndFunctionPromptFunction) => {
      setFullPrompts((prev) => {
        if (prev === undefined) {
          return undefined;
        }
        const newFunctions = [...prev.functions];
        newFunctions[functionIndex] = data;

        if (typeof prev.prompt !== "string" && "functions" in prev.prompt) {
          return {
            prompt: {
              ...prev.prompt,
              functions: newFunctions,
            },
            texts: prev.texts,
            functions: newFunctions,
          };
        } else {
          return {
            prompt: prev.prompt,
            texts: prev.texts,
            functions: newFunctions,
          };
        }
      });
    },
    100
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
          setOutput(undefined);
        })
        .catch((error) => {
          setErrorMessage(error.message);
          setPrompt(undefined);
          setCompletion(undefined);
          setOutput(undefined);
        });
    },
    []
  );

  useEffect(() => {
    if (completionTextAreaRef.current) {
      completionTextAreaRef.current.value = completion?.content ?? "";
      fixTextareaHeight(completionTextAreaRef.current);
    }
  }, [completion]);

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
        let start = performance.now();
        setTimeToFirstToken(undefined);
        setTimeToRemainingTokens(undefined);
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

        let first = true;
        for await (const message of stream) {
          if (first) {
            setTimeToFirstToken(performance.now() - start);
            first = false;
            start = performance.now();
          }
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
        setTimeToRemainingTokens(performance.now() - start);
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
          fullPrompts.functions.map((f, index) => (
            <FullPromptFunction
              fn={f}
              functionIndex={index}
              setForceRerender={setForceRerender}
              debouncedSetFnData={debouncedSetFunctionData}
              prompt={prompt}
            />
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
                    <TextAreaWithSetting
                      key={`${i}-${forceRerender}`}
                      setFullText={(newText: string) => {
                        debouncedSetFullPrompts(i, newText);
                      }}
                      setTextArea={(value: HTMLTextAreaElement | undefined) => {
                        textAreaRefs.current[i] = value;
                      }}
                      currentTextArea={textAreaRefs.current[i]}
                    />
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
        {ALL_MODELS.map((model) => (
          <button key={model} onClick={() => streamCompletion(model)}>
            Submit to {model}
          </button>
        ))}
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
            {completion ? (
              <TextAreaWithSetting
                key={`completion-${forceRerender}`}
                setFullText={(newText: string) => {
                  setCompletion({
                    ...completion,
                    content: newText,
                  });
                }}
                setTextArea={(value: HTMLTextAreaElement | undefined) => {
                  completionTextAreaRef.current = value;
                }}
                currentTextArea={completionTextAreaRef.current}
              />
            ) : (
              ""
            )}
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
          {(timeToFirstToken !== undefined ||
            timeToRemainingTokens !== undefined) && (
            <div
              style={{
                whiteSpace: "pre-wrap",
                border: "solid 1px",
              }}
            >
              <div>Time to first token: {timeToFirstToken ?? "loading..."}</div>
              <div>
                Time to remaining tokens:{" "}
                {timeToRemainingTokens ?? "loading..."}
              </div>
            </div>
          )}
          <button onClick={() => getPromptOutput(false)}>
            get parsed output
          </button>
          <button onClick={() => getPromptOutput(true)}>
            get parsed stream
          </button>
          {output && (
            <div
              style={{
                whiteSpace: "pre-wrap",
                border: "solid 1px",
              }}
            >
              <b>Output (also console.logged):</b>
              <pre>{output}</pre>
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
              onKeyDown={(e) => {
                // Capture all keydown events
                e.stopPropagation();
              }}
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

function TextAreaWithSetting(props: {
  setTextArea: (value: HTMLTextAreaElement | undefined) => void;
  currentTextArea: HTMLTextAreaElement | undefined;
  key: string;
  setFullText: (value: string) => void;
  style?: React.CSSProperties;
}) {
  return (
    <textarea
      ref={(el) => props.setTextArea(el ?? undefined)}
      id={`prompt-textarea-${props.key}`}
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
        ...props.style,
      }}
      onKeyDown={(e) => {
        // Capture all keydown events
        e.stopPropagation();
      }}
      onChange={(e) => {
        // Get the scroll height and adjust the height accordingly
        fixTextareaHeight(e.target);
        // console.log("CHANGING!", e);

        // const currentTextArea = textAreaRefs.current[i];
        if (props.currentTextArea !== undefined) {
          props.currentTextArea.value = e.target.value ?? "";
        }
        props.setFullText(e.target.value ?? "");
      }}
      spellCheck={false}
    />
  );
}

function FullPromptFunction({
  fn,
  functionIndex,
  debouncedSetFnData,
  prompt,
  setForceRerender,
}: {
  fn: ChatAndFunctionPromptFunction;
  functionIndex: number;
  debouncedSetFnData: (
    index: number,
    newData: ChatAndFunctionPromptFunction
  ) => void;
  prompt: Prompt | undefined;
  setForceRerender: (fn: (oldValue: number) => number) => void;
}) {
  const functionNameRef = useRef<HTMLTextAreaElement>();
  const functionDescriptionRef = useRef<HTMLTextAreaElement>();
  const functionParametersRef = useRef<HTMLTextAreaElement>();
  const forceRerender = useCallback(() => {
    setForceRerender((oldValue: number) => oldValue + 1);
  }, [setForceRerender]);

  useEffect(() => {
    console.log("CURRENT PROMPT", prompt);
    console.log("CURRENT FUNCTION index", functionIndex);
    console.log("FORCE RERENDER", forceRerender);
    if (prompt) {
      if (
        typeof prompt !== "string" &&
        prompt !== undefined &&
        prompt.type === "chat" &&
        "functions" in prompt
      ) {
        if (functionIndex >= prompt.functions.length) {
          // Set everything to undefined and force a rerender
          functionNameRef.current = undefined;
          functionDescriptionRef.current = undefined;
          functionParametersRef.current = undefined;

          // Force a rerender
          forceRerender();
          return;
        }

        if (functionNameRef.current) {
          functionNameRef.current.value =
            prompt.functions[functionIndex].name ?? "";
          fixTextareaHeight(functionNameRef.current);
        }
        if (functionDescriptionRef.current) {
          functionDescriptionRef.current.value =
            prompt.functions[functionIndex].description ?? "";
          fixTextareaHeight(functionDescriptionRef.current);
        }

        if (functionParametersRef.current) {
          functionParametersRef.current.value = JSON.stringify(
            prompt.functions[functionIndex].parameters ?? "",
            null,
            2
          );
          fixTextareaHeight(functionParametersRef.current);
        }
      }
    }
  }, [prompt, functionIndex, forceRerender]);

  const setNewName = useCallback(
    (newName: string) => {
      debouncedSetFnData(functionIndex, {
        ...fn,
        name: newName,
      });
    },
    [fn, debouncedSetFnData, functionIndex]
  );

  const setNewDescription = useCallback(
    (newDescription: string) => {
      debouncedSetFnData(functionIndex, {
        ...fn,
        description: newDescription,
      });
    },
    [fn, debouncedSetFnData, functionIndex]
  );

  const setNewParameters = useCallback(
    (newParameters: string) => {
      debouncedSetFnData(functionIndex, {
        ...fn,
        parameters: JSON.parse(newParameters),
      });
    },
    [fn, debouncedSetFnData, functionIndex]
  );

  return (
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
          <TextAreaWithSetting
            style={{
              border: "solid 1px rgba(0,0,0,0.2)",
              whiteSpace: "pre-wrap",
            }}
            setTextArea={(el) => {
              functionNameRef.current = el ?? undefined;
            }}
            currentTextArea={functionNameRef.current}
            key=""
            setFullText={setNewName}
            // key={`function-name-${functionIndex}`}
          />
        </div>
        <div>
          <i>description:</i>
          {/* TODO - make this a textarea */}
          <TextAreaWithSetting
            style={{
              border: "solid 1px rgba(0,0,0,0.2)",
              whiteSpace: "pre-wrap",
            }}
            setTextArea={(el) => {
              functionDescriptionRef.current = el ?? undefined;
            }}
            currentTextArea={functionDescriptionRef.current}
            key=""
            setFullText={setNewDescription}
          />
        </div>
        <div>
          <i>parameters:</i>
          <TextAreaWithSetting
            style={{
              border: "solid 1px rgba(0,0,0,0.2)",
              whiteSpace: "pre-wrap",
            }}
            setTextArea={(el) => {
              functionParametersRef.current = el ?? undefined;
            }}
            currentTextArea={functionParametersRef.current}
            key=""
            setFullText={setNewParameters}
          />
          {/* {JSON.stringify(f.parameters, null, 2)}
          </div> */}
        </div>
      </div>
    </div>
  );
}

function streamify(
  m: ChatCompletionResponseMessage | undefined
): ChatCompletionResponseMessage[] {
  if (m === undefined) {
    return [];
  }
  const content = m.content ?? "";
  const chunks = [];

  let chunkSize = Math.floor(Math.random() * 8) + 1;
  for (let i = 0; i < content.length; i += chunkSize) {
    chunkSize = Math.floor(Math.random() * 8) + 1; // Choose a different length for each yield
    chunks.push({
      ...m,
      content: content.slice(i, i + chunkSize),
    });
  }

  return chunks;
}
