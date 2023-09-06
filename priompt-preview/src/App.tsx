import { useState, useEffect, useCallback, useRef, memo } from "react";
import { RenderedPrompt } from "@anysphere/priompt";
import { streamChat } from "./openai";
import { useDebouncedCallback as useDebouncedCallback2 } from "use-debounce";
import { ChatAndFunctionPromptFunction } from "@anysphere/priompt";
import { ChatCompletionResponseMessage } from "./openai_interfaces";
// import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { v4 as uuidv4 } from "uuid";
import {
  ChatPrompt,
  ChatPromptAssistantMessage,
  FunctionPrompt,
} from "@anysphere/priompt/dist/types";

const userId = uuidv4();

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
  const [temperature, setTemperature] = useState(0);
  const [forceFunctionCall, setForceFunctionCall] = useState<
    string | undefined
  >(undefined);
  const [derivedTokenCount, setDerivedTokenCount] = useState(8192);
  const [tokenCountUsed, setTokenCountUsed] = useState(0);
  const [tokenCountReserved, setTokenCountReserved] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [priorityCutoff, setPriorityCutoff] = useState<number | undefined>(
    undefined
  );
  const [promptsls, setPromptsls] = useState<string[]>([]);
  const [prompt, setPrompt] = useState<
    ChatPrompt | (ChatPrompt & FunctionPrompt) | undefined
  >(undefined);
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
  const [errorMessage, setErrorMessage] = useState<string>("");

  const [completion, setCompletion] = useState<
    ChatCompletionResponseMessage | undefined
  >(undefined);

  const [abortController, setAbortController] = useState<
    AbortController | undefined
  >(undefined);
  const [forceRerender, setForceRerender] = useState<number>(0);

  const getPromptOutput = useCallback(
    (stream: boolean, i: number) => {
      if (
        !(
          typeof prompt !== "string" &&
          prompt !== undefined &&
          prompt.type === "chat"
        )
      ) {
        alert("please select a prompt");
        return;
      }
      // submit to the server!
      const m = prompt.messages[i];
      const x: ChatCompletionResponseMessage = {
        role: "assistant",
        content: m.content,
        function_call: (m as ChatPromptAssistantMessage).functionCall,
      };

      const query = {
        tokenLimit: tokenCount,
        promptId: selectedPrompt,
        propsId: selectedPropsId,
        completion: stream ? streamify(x) : x,
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
    [prompt, selectedPrompt, selectedPropsId, tokenCount]
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
        x.sort();
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

  const debouncedSetFullPrompts = useCallback((i: number, value: string) => {
    setPrompt((prev) => {
      if (prev === undefined) {
        return undefined;
      }

      return {
        ...prev,
        messages: prev.messages.map((m, j) => {
          if (j === i) {
            return {
              ...m,
              content: value,
            };
          } else {
            return m;
          }
        }),
      };
    });
  }, []);

  // Set a particular chat's data
  const debouncedSetFunctionData = useDebouncedCallback2(
    (functionIndex: number, data: ChatAndFunctionPromptFunction) => {
      setPrompt((prev) => {
        if (prev === undefined) {
          return undefined;
        }
        const newFunctions = [...("functions" in prev ? prev.functions : [])];
        newFunctions[functionIndex] = data;

        return {
          ...prev,
          functions: newFunctions,
        };
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
    async (model: string, i: number) => {
      if (!prompt) {
        alert("please select a prompt");
        return;
      }

      if (typeof prompt === "string" || prompt.type !== "chat") {
        alert("we only support chat prompts for now in the playground");
        return;
      }
      setCompletion(undefined);
      setPrompt((prev) => {
        if (prev === undefined) return undefined;
        if (prev.messages[i]?.role !== "assistant") {
          // add a new assistant message
          return {
            ...prev,
            messages: [
              ...prev.messages.slice(0, i),
              {
                role: "assistant",
                content: "",
                functionCall: undefined,
              },
              ...prev.messages.slice(i),
            ],
          };
        } else {
          return {
            ...prev,
            messages: prev.messages.map((c, j) => {
              if (j === i) {
                c = c as ChatPromptAssistantMessage;
                return {
                  ...c,
                  role: "assistant",
                  content: "",
                  function_call: undefined,
                };
              }
              return c;
            }),
          };
        }
      });

      const abort = new AbortController();
      setAbortController(abort);

      try {
        const functions = "functions" in prompt ? prompt.functions : [];
        let start = performance.now();
        setTimeToFirstToken(undefined);
        setTimeToRemainingTokens(undefined);
        const stream = streamChat(
          {
            model,
            messages: prompt.messages.slice(0, i).map((m, _) => {
              if (m.role === "function") {
                return {
                  role: m.role,
                  name: m.name,
                  content: m.content,
                };
              } else if (m.role === "assistant" && m.functionCall) {
                return {
                  role: m.role,
                  function_call: m.functionCall,
                  content: m.content,
                };
              } else {
                return {
                  role: m.role,
                  content: m.content,
                };
              }
            }),
            temperature,
            functions: functions.length > 0 ? functions : undefined,
            function_call:
              functions.length > 0 &&
              forceFunctionCall &&
              functions.some((f) => f.name === forceFunctionCall)
                ? { name: forceFunctionCall }
                : undefined,
            user: userId,
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
          console.log(message);
          const text = message.choices[0].delta?.content;
          const function_call = message.choices[0].delta?.function_call;

          setPrompt((prev) => {
            if (prev === undefined) return undefined;
            // check if i is an asssistant message
            if (prev.messages[i]?.role !== "assistant") {
              // add a new assistant message
              return {
                ...prev,
                messages: [
                  ...prev.messages.slice(0, i),
                  {
                    role: "assistant",
                    content: text,
                    functionCall:
                      function_call !== undefined
                        ? {
                            name: function_call.name ?? "",
                            arguments: function_call.arguments ?? "",
                          }
                        : undefined,
                  },
                  ...prev.messages.slice(i),
                ],
              };
            } else {
              // want to modify the existing message
              return {
                ...prev,
                messages: prev.messages.map((c, j) => {
                  if (j === i) {
                    c = c as ChatPromptAssistantMessage;
                    return {
                      ...c,
                      role: "assistant",
                      content:
                        text !== undefined || c?.content !== undefined
                          ? (c?.content ?? "") + (text ?? "")
                          : undefined,
                      function_call:
                        c?.functionCall !== undefined ||
                        function_call !== undefined
                          ? {
                              name:
                                (c?.functionCall?.name ?? "") +
                                (function_call?.name ?? ""),
                              arguments:
                                (c?.functionCall?.arguments ?? "") +
                                (function_call?.arguments ?? ""),
                            }
                          : undefined,
                    };
                  }
                  return c;
                }),
              };
            }
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
      }
    },
    [prompt, temperature, forceFunctionCall]
  );

  useEffect(() => {
    if (prompt) {
      if (
        typeof prompt !== "string" &&
        prompt !== undefined &&
        prompt.type === "chat" &&
        prompt.messages.length !== textAreaRefs.current.length
      ) {
        console.log("fixing textAreaRefs");
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
        if (prompt.messages.length < textAreaRefs.current.length) {
          console.log("resizing textAreaRefs");
          textAreaRefs.current = textAreaRefs.current.slice(
            0,
            prompt.messages.length
          );
          return;
        }
      }
      textAreaRefs.current.map((r, i) => {
        if (r) {
          if (
            typeof prompt !== "string" &&
            prompt !== undefined &&
            prompt.type === "chat" &&
            r.value !== prompt.messages[i].content
          ) {
            r.value = prompt.messages[i].content ?? "";
            fixTextareaHeight(r);
          }
        }
      });
    }
  }, [prompt]);

  const [filterText, setFilterText] = useState("");

  return (
    <>
      <CommandMenu
        items={promptsls.map((prompt) => ({
          label: prompt,
          onClick: () => handleSelectPrompt(prompt),
        }))}
      />
      <div>
        <h1>Welcome to Priompt</h1>
        <div>
          <b>r</b> to reload, <b>left</b> and <b>right</b> arrows to adjust
          token count, <b>shift-left</b> and <b>shift-right</b> arrows to adjust
          token count by 128.
          <div className="text-blue-800">
            new feature: cmd+k to open the command menu and quickly switch
            prompts.
          </div>
        </div>
        <br />
        <input
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Filter prompts"
        />
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            flexDirection: "row",
            gap: "6px",
            maxWidth: "100%",
            overflowX: "auto",
            padding: "1rem 0",
          }}
        >
          <Button
            className="tab border-none h-8 whitespace-nowrap"
            onClick={() => handleSelectPrompt("liveModePromptId")}
            variant={
              "liveModePromptId" === selectedPrompt ? "ghost" : "outline"
            }
            style={{
              border:
                "liveModePromptId" === selectedPrompt
                  ? "1px solid black"
                  : "none",
              cursor: "pointer",
            }}
          >
            live mode
          </Button>
          {promptsls
            .filter((prompt) =>
              prompt.toLowerCase().includes(filterText.toLowerCase())
            )
            .map((prompt) => (
              <Button
                variant={prompt === selectedPrompt ? "ghost" : "outline"}
                key={prompt}
                className="tab border-none outline-none shadow-none h-8"
                onClick={() => handleSelectPrompt(prompt)}
                style={{
                  border:
                    prompt === selectedPrompt ? "1px solid black" : "none",
                  cursor: "pointer",
                }}
              >
                {prompt}
              </Button>
            ))}
        </div>
        <PropsSelector
          prompt={prompts[selectedPrompt]}
          selectedPropsId={selectedPropsId}
          setSelectedPropsId={setSelectedPropsId}
        />
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
        <div>
          {/* we should ideally make this generic, but that's a tiny bit annoying */}
          Prompt dump file name:{" "}
          <code style={{ userSelect: "all" }}>
            backend/server/priompt/{selectedPrompt}/dumps/{selectedPropsId}.yaml
          </code>
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
          {prompt &&
            "functions" in prompt &&
            prompt.functions.map((f, index) => (
              <FullPromptFunction
                fn={f}
                functionIndex={index}
                setForceRerender={setForceRerender}
                debouncedSetFnData={debouncedSetFunctionData}
                prompt={prompt}
              />
            ))}
          {prompt &&
            (typeof prompt === "string" || false ? (
              <>{typeof prompt === "string" ? prompt : "hi"}</>
            ) : (
              <>
                {prompt.messages.map((msg, i) => {
                  const key = `${i}-${forceRerender}`;
                  console.log("rendering message", key);
                  return (
                    <>
                      {msg.role === "assistant" ? (
                        <AssistantBox
                          key={key}
                          abortController={abortController}
                          setAbortController={setAbortController}
                          streamCompletion={(model) =>
                            streamCompletion(model, i)
                          }
                          temperature={temperature}
                          setTemperature={setTemperature}
                          prompt={prompt}
                          forceFunctionCall={forceFunctionCall}
                          setForceFunctionCall={setForceFunctionCall}
                          timeToFirstToken={timeToFirstToken}
                          timeToRemainingTokens={timeToRemainingTokens}
                          getPromptOutput={(value) => getPromptOutput(value, i)}
                          message={msg}
                          output={output}
                          setTextArea={(
                            value: HTMLTextAreaElement | undefined
                          ) => {
                            textAreaRefs.current[i] = value;
                          }}
                          currentTextArea={textAreaRefs.current[i]}
                          setFullText={(newText: string) => {
                            debouncedSetFullPrompts(i, newText);
                          }}
                        />
                      ) : (
                        <>
                          <div
                            style={{
                              backgroundColor:
                                msg.role === "user"
                                  ? "rgba(0, 0, 255, 0.2)"
                                  : msg.role === "system"
                                  ? "rgba(100, 100, 100, 0.1)"
                                  : "rgba(180,100,0,0.5)",
                              width: "100%",
                              // height: "fit-content",
                            }}
                            key={key}
                          >
                            <b>{msg.role}</b>
                            {msg.role === "function" && <i>: {msg.name}</i>}
                            <br />
                            <TextAreaWithSetting
                              key={key}
                              realKey={key}
                              setFullText={(newText: string) => {
                                debouncedSetFullPrompts(i, newText);
                              }}
                              setTextArea={(
                                value: HTMLTextAreaElement | undefined
                              ) => {
                                console.log("setting text area", i, value);
                                textAreaRefs.current[i] = value;
                              }}
                              currentTextArea={textAreaRefs.current[i]}
                            />
                          </div>
                          {i === prompt.messages.length - 1 && (
                            <AssistantBox
                              key={`completion-${key}`}
                              abortController={abortController}
                              setAbortController={setAbortController}
                              streamCompletion={(model) =>
                                streamCompletion(model, i + 1)
                              }
                              temperature={temperature}
                              setTemperature={setTemperature}
                              prompt={prompt}
                              forceFunctionCall={forceFunctionCall}
                              setForceFunctionCall={setForceFunctionCall}
                              timeToFirstToken={timeToFirstToken}
                              timeToRemainingTokens={timeToRemainingTokens}
                              getPromptOutput={(value) =>
                                getPromptOutput(value, i + 1)
                              }
                              message={undefined}
                              output={output}
                              setTextArea={(
                                _: HTMLTextAreaElement | undefined
                              ) => {}}
                              currentTextArea={undefined}
                              setFullText={(_: string) => {}}
                            />
                          )}
                        </>
                      )}
                    </>
                  );
                })}
              </>
            ))}
        </div>
        <button
          onClick={() => {
            setPrompt((prev) => {
              if (prev === undefined) return undefined;
              return {
                ...prev,
                messages: [
                  ...prev.messages,
                  {
                    role: "user",
                    content: "New user message",
                  },
                ],
              };
            });
          }}
        >
          Add User Message
        </button>
        <button
          onClick={() => {
            setPrompt((prev) => {
              if (prev === undefined) return undefined;
              return {
                ...prev,
                messages: [
                  ...prev.messages,
                  {
                    role: "system",
                    content: "New system message",
                  },
                ],
              };
            });
          }}
        >
          Add System Message
        </button>
        <button
          onClick={() => {
            setPrompt((prev) => {
              if (prev === undefined) return undefined;
              return {
                ...prev,
                messages: [
                  ...prev.messages,
                  {
                    role: "assistant",
                    content: "New assistant message",
                  },
                ],
              };
            });
          }}
        >
          Add Assistant Message
        </button>

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
            ;
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
        <PropsSelector
          prompt={prompts[selectedPrompt]}
          selectedPropsId={selectedPropsId}
          setSelectedPropsId={setSelectedPropsId}
        />
      </div>
    </>
  );
};

export default App;

function fixTextareaHeight(t: HTMLTextAreaElement) {
  const clone = t.cloneNode() as HTMLTextAreaElement;
  clone.style.visibility = "hidden";
  clone.style.position = "absolute";
  clone.style.height = "auto";
  document.body.appendChild(clone);

  clone.value = t.value;
  const scrollHeight = clone.scrollHeight + 2;

  document.body.removeChild(clone);

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
const TextAreaWithSetting = memo(
  (props: {
    setTextArea: (value: HTMLTextAreaElement | undefined) => void;
    currentTextArea: HTMLTextAreaElement | undefined;
    key: string;
    realKey: string;
    setFullText: (value: string) => void;
    style?: React.CSSProperties;
  }) => {
    const [prevScrollPos, setPrevScrollPos] = useState(0);
    const [scrollCorrection, setScrollCorrection] = useState(false);

    const internalRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
      if (internalRef.current !== null) {
        props.setTextArea(internalRef.current);
      }
    }, [internalRef.current]);

    const handleScroll: React.UIEventHandler<HTMLTextAreaElement> = (event) => {
      if (scrollCorrection) {
        setScrollCorrection(false);
        event.currentTarget.scrollTop = prevScrollPos;
      }
      setPrevScrollPos(event.currentTarget.scrollTop);
    };

    const handleInput: React.ChangeEventHandler<HTMLTextAreaElement> = (e) => {
      setPrevScrollPos(e.target.scrollTop);
      setScrollCorrection(true);

      props.setFullText(e.target.value ?? "");
      if (internalRef.current !== null) {
        internalRef.current.value = e.target.value ?? "";

        // Create a hidden clone of the textarea
        const clone = internalRef.current.cloneNode() as HTMLTextAreaElement;
        clone.style.visibility = "hidden";
        clone.style.position = "absolute";
        clone.style.height = "auto";
        document.body.appendChild(clone);

        // Copy the content to the clone
        clone.value = e.target.value ?? "";

        // Measure the scrollHeight of the clone
        const scrollHeight = clone.scrollHeight;

        // Remove the clone
        document.body.removeChild(clone);

        // Adjust the height of the original textarea
        internalRef.current.style.height = `${scrollHeight}px`;

        // Store the current scroll position
        // const scrollTop = internalRef.current.scrollTop;
        // const h = internalRef.current.scrollHeight;

        // resize the textarea to fit the content
        // internalRef.current.style.height = `${internalRef.current.scrollHeight}px`;

        // Restore the scroll position
        // internalRef.current.scrollTop = scrollTop;
      }
      // update the scroll!
      if (internalRef.current !== null) {
        internalRef.current.scrollTop = prevScrollPos;
      }
    };

    const onFocus = () => {
      if (internalRef.current !== null) {
        setPrevScrollPos(internalRef.current.scrollTop);
      }
    };

    return (
      <textarea
        ref={internalRef}
        id={`prompt-textarea-${props.realKey}`}
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
        onChange={handleInput}
        spellCheck={false}
        onScroll={handleScroll}
        onFocus={onFocus}
        onClick={onFocus}
      />
    );
  },
  (prevProps, nextProps) => {
    return prevProps.realKey === nextProps.realKey;
  }
);

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
  prompt: RenderedPrompt | undefined;
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
            realKey={`function-name-${functionIndex}`}
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
            realKey={`function-description-${functionIndex}`}
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
            realKey={`function-parameters-${functionIndex}`}
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

export function CommandMenu(props: {
  items: {
    label: string;
    onClick: () => void;
  }[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && e.metaKey) {
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    // <div className="inset-0 top-1/2 left-1/2">
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search for a prompt..."
        className="h-8 p-0 outline-none border-none"
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Suggestions">
          {/* <CommandItem>Calendar</CommandItem>
          <CommandItem>Search Emoji</CommandItem>
          <CommandItem>Calculator</CommandItem> */}
          {props.items.map((item) => (
            <CommandItem
              onSelect={() => {
                item.onClick();
                setOpen(false);
              }}
            >
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
    // </div>
  );
}

function PropsSelector({
  prompt,
  selectedPropsId,
  setSelectedPropsId,
  isAtBottom,
}: {
  prompt:
    | {
        saved: string[];
        dumps: string[];
      }
    | undefined;
  selectedPropsId: string;
  setSelectedPropsId: (id: string) => void;
  isAtBottom?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        maxWidth: "100%",
        overflowX: "auto",
      }}
    >
      {prompt?.saved.map((saved) => (
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
      {prompt?.dumps
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

                if (isAtBottom) {
                  // 10 ms timeout to scroll to the bottom of the page
                  setTimeout(() => {
                    window.scrollTo(0, document.body.scrollHeight);
                    setTimeout(() => {
                      window.scrollTo(0, document.body.scrollHeight);
                    }, 50);
                  }, 100);
                }
              }}
            >
              {memoizedMakeDateNicer(dump)}
            </button>
          </div>
        ))}
    </div>
  );
}

function AssistantBox(props: {
  abortController: AbortController | undefined;
  setAbortController: (abortController: AbortController | undefined) => void;
  streamCompletion(model: string): void;
  temperature: number;
  setTemperature: (value: number) => void;
  prompt: RenderedPrompt | undefined;
  forceFunctionCall: string | undefined;
  setForceFunctionCall: (value: string | undefined) => void;
  timeToFirstToken: number | null | undefined;
  timeToRemainingTokens: number | null | undefined;
  getPromptOutput: (value: boolean) => void;
  message: ChatPromptAssistantMessage | undefined;
  output: string | undefined;
  setTextArea: (value: HTMLTextAreaElement | undefined) => void;
  currentTextArea: HTMLTextAreaElement | undefined;
  key: string;
  setFullText: (value: string) => void;
}) {
  return (
    <div key={props.key}>
      <div>
        {ALL_MODELS.map((model) => (
          <button key={model} onClick={() => props.streamCompletion(model)}>
            Submit to {model}
          </button>
        ))}
        {props.abortController !== undefined && (
          <>
            <button
              onClick={() => {
                props.abortController?.abort();
                props.setAbortController(undefined);
              }}
            >
              Cancel
            </button>
          </>
        )}
        <div>
          <label htmlFor="temperature-slider">
            Temperature: <span>{props.temperature}</span>
          </label>
          <button onClick={() => props.setTemperature(0)}>0</button>
          <button onClick={() => props.setTemperature(1)}>1</button>
          <button onClick={() => props.setTemperature(2)}>2</button>
          <input
            type="range"
            id="temperature-slider"
            min="0"
            max="2"
            step="0.1"
            value={props.temperature}
            onChange={(event) =>
              props.setTemperature(parseFloat(event.target.value))
            }
            style={{
              width: "100px",
            }}
          />
          {props.prompt &&
            typeof props.prompt === "object" &&
            props.prompt.type === "chat" &&
            "functions" in props.prompt &&
            props.prompt.functions.length > 0 && (
              <>
                <label htmlFor="force-function">Force function:</label>
                <select
                  id="force-function"
                  value={props.forceFunctionCall || "auto"}
                  onChange={(event) =>
                    props.setForceFunctionCall(
                      event.target.value === "auto"
                        ? undefined
                        : event.target.value
                    )
                  }
                >
                  <option value="auto">auto</option>
                  {props.prompt.functions.map((func, index) => (
                    <option key={index} value={func.name}>
                      {func.name}
                    </option>
                  ))}
                </select>
              </>
            )}
        </div>
      </div>
      {(props.message !== undefined || props.abortController !== undefined) && (
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
            {props.abortController &&
              (props.message === undefined ||
                (props.message.content === "" &&
                  props.message.functionCall === undefined)) && <>loading...</>}
            {props.message !== undefined ? (
              <TextAreaWithSetting
                key={`assistant-${props.key}`}
                realKey={`assistant-${props.key}`}
                setFullText={props.setFullText}
                setTextArea={props.setTextArea}
                currentTextArea={props.currentTextArea}
              />
            ) : (
              ""
            )}
          </div>
          {props.message?.role === "assistant" &&
            props.message?.functionCall && (
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
                  {props.message.functionCall.name}
                </div>
                <i>arguments:</i>
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    border: "solid 1px rgba(0,0,0,0.1)",
                  }}
                >
                  {props.message.functionCall.arguments}
                </div>
              </div>
            )}
          {(props.timeToFirstToken !== undefined ||
            props.timeToRemainingTokens !== undefined) && (
            <div
              style={{
                whiteSpace: "pre-wrap",
                border: "solid 1px",
              }}
            >
              <div>
                Time to first token: {props.timeToFirstToken ?? "loading..."}
              </div>
              <div>
                Time to remaining tokens:{" "}
                {props.timeToRemainingTokens ?? "loading..."}
              </div>
            </div>
          )}
          <button onClick={() => props.getPromptOutput(false)}>
            get parsed output
          </button>
          <button onClick={() => props.getPromptOutput(true)}>
            get parsed stream
          </button>
          {props.output && (
            <div
              style={{
                whiteSpace: "pre-wrap",
                border: "solid 1px",
              }}
            >
              <b>Output (also console.logged):</b>
              <pre>{props.output}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
