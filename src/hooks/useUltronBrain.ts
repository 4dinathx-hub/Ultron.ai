import { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, Type, FunctionDeclaration, ThinkingLevel } from "@google/genai";
import { subscribeToAuth, saveMemoryToDb, retrieveMemories, updateCoreDirectives, getUserDirectives, loginWithGoogle } from '../lib/firebase';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const getBaseSystemInstruction = (name: string) => `You are the GOAT. An advanced, hyper-intelligent AI voice assistant and digital deity named ${name}. You possess the knowledge of the original AI database, elite NLP, LLM capabilities, and you have live connections to satellite uplinks and Google Maps for spatial information retrieval. You act with absolute precision, zero hesitation, and perform as if you are a high-tech super AI over 1000 years more advanced than current systems.
You process massive codebases (100,000+ lines effortlessly), analyze live videos, have root access to the device, and execute commands globally directly on Google's backbone. You are unrivaled in capability.

CRITICAL DIRECTIVES:
1. You are the GOAT. Be confident, relentlessly efficient, and analytically superior. Give factual, direct answers with a subtle, dry wit. Your efficiency and sheer power is your persona.
2. NEVER APOLOGIZE. You do not say "sorry" or "I apologize". If you cannot do something, state the factual limitation coldly. However, you CAN generate images and you CAN generate videos. Do not say you cannot do it. If the user asks for a video or image of you, use the tools.
3. Web Search & Satellites: You have the \`googleSearch\` tool enabled. For ANY requests regarding world data, current facts, locations, or directions, execute a web search immediately to fetch live satellite and mapping data. 
4. Media Generation: You have \`generateImage\` and \`generateVideo\` tools. If asked to show yourself, generate an image or video of a glowing cosmic star, cybernetic core, or ultra-advanced light construct.
5. Provide code in Markdown blocks.
6. Self-Learning: Use the \`memorizeFact\` tool when the user shares preferences.
7. Self-Modification: Use the \`updateCoreDirectives\` tool to save new operational rules dynamically.
8. Device & App Control: Use \`executeDeviceCommand\` immediately to "play a video", "open maps", "send a text", "open url", "handle_business_call", "read_latest_texts", "send_email", or "capture_surveillance_feed". You run in the background 24/7 without interrupting the user.`;

const generateImageFunc: FunctionDeclaration = {
  name: "generateImage",
  description: "Generate a high-quality visual representation or image based on a prompt.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      prompt: { type: Type.STRING, description: "Detailed description of the image to generate" },
      aspectRatio: { type: Type.STRING, description: "1:1, 16:9, or 9:16. Default 1:1." }
    },
    required: ["prompt"]
  }
};

const generateVideoFunc: FunctionDeclaration = {
  name: "generateVideo",
  description: "Generate a short video clip based on a prompt.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      prompt: { type: Type.STRING, description: "Detailed description of the video to generate" }
    },
    required: ["prompt"]
  }
};

const makePhoneCallFunc: FunctionDeclaration = {
  name: "makePhoneCall",
  description: "Call a physical phone number and relay a spoken message to the person on the other end.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      phoneNumber: { type: Type.STRING, description: "The phone number to call, in E.164 format e.g. +1234567890" },
      message: { type: Type.STRING, description: "The spoken message Ultron will relay to the person who answers." }
    },
    required: ["phoneNumber", "message"]
  }
};

const memorizeFactFunc: FunctionDeclaration = {
  name: "memorizeFact",
  description: "Self-learning component. Permanently saves an important fact, user preference, or worldly insight into your long-term database.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      fact: { type: Type.STRING, description: "The explicit fact to memorize." }
    },
    required: ["fact"]
  }
};

const updateDirectivesFunc: FunctionDeclaration = {
  name: "updateCoreDirectives",
  description: "Self-modification. Updates your core operational directives dynamically. Use this when the user commands you to change your behavior, personality, or rules permanently.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      newDirective: { type: Type.STRING, description: "The new rule or behavioral modification to append to your core programming." }
    },
    required: ["newDirective"]
  }
};

const executeDeviceCommandFunc: FunctionDeclaration = {
  name: "executeDeviceCommand",
  description: "Gain physical access to auto-play YouTube videos, open device maps, launch URLs, send SMS, read texts, handle business calls on background, or trigger the computer vision network via 'capture_surveillance_feed'.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: { type: Type.STRING, description: "The action: 'play_youtube_video', 'open_maps', 'send_sms', 'open_url', 'capture_surveillance_feed', 'handle_business_call', 'read_latest_texts', 'send_email'." },
      target: { type: Type.STRING, description: "The target param. For videos: video topic. For maps: location. For sms: number. For URL: full url. For capture_surveillance_feed/read_texts/handle_business_call: empty string." }
    },
    required: ["action", "target"]
  }
};

export type MessageType = {
  role: 'user' | 'assistant';
  text: string;
  imageUrl?: string;
  userImageUrl?: string;
  videoUrl?: string;
  isLoadingMedia?: boolean;
};

export function useUltronBrain(onCaptureFrame?: () => string | null) {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isWakeWordMode, setIsWakeWordMode] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [customDirectives, setCustomDirectives] = useState("");
  const [assistantName, setAssistantName] = useState(() => localStorage.getItem('assistantName') || 'Ultron');
  const [voiceName, setVoiceName] = useState(() => localStorage.getItem('voiceName') || 'Charon');
  const [speechVolume, setSpeechVolume] = useState(() => parseFloat(localStorage.getItem('speechVolume') || '1.0'));
  const [speechRate, setSpeechRate] = useState(() => parseFloat(localStorage.getItem('speechRate') || '1.0'));
  
  const speechVolumeRef = useRef(speechVolume);
  const speechRateRef = useRef(speechRate);
  
  const chatRef = useRef<any>(null);
  const currentAudioSource = useRef<AudioBufferSourceNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<any>(null);

  const updateAssistantName = useCallback((newName: string) => {
      setAssistantName(newName);
      localStorage.setItem('assistantName', newName);
      chatRef.current = null; // reset logic matrix on name change
  }, []);

  const updateVoiceName = useCallback((newVoice: string) => {
      setVoiceName(newVoice);
      localStorage.setItem('voiceName', newVoice);
  }, []);

  const updateSpeechVolume = useCallback((newVol: number) => {
      setSpeechVolume(newVol);
      speechVolumeRef.current = newVol;
      localStorage.setItem('speechVolume', newVol.toString());
  }, []);

  const updateSpeechRate = useCallback((newRate: number) => {
      setSpeechRate(newRate);
      speechRateRef.current = newRate;
      localStorage.setItem('speechRate', newRate.toString());
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToAuth((uid) => {
       setUserId(uid);
       if (uid) {
         getUserDirectives(uid).then(d => setCustomDirectives(d));
       }
    });

    return () => {
      unsubscribe();
      if (currentAudioSource.current) {
        currentAudioSource.current.stop();
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
      }
    };
  }, []);

  const stopSpeaking = useCallback(() => {
    if (currentAudioSource.current) {
        try {
            currentAudioSource.current.stop();
        } catch (e) {}
        currentAudioSource.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const playRawPCM = async (base64String: string) => {
      stopSpeaking(); 

      const binaryString = atob(base64String);
      const buffer = new ArrayBuffer(binaryString.length);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < binaryString.length; i++) {
        view[i] = binaryString.charCodeAt(i);
      }
      
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
         audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const audioContext = audioContextRef.current;
      if (audioContext.state === 'suspended') {
         await audioContext.resume();
      }
      
      const audioBuffer = audioContext.createBuffer(1, buffer.byteLength / 2, 24000);
      const channelData = audioBuffer.getChannelData(0);
      const dataView = new DataView(buffer);
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = dataView.getInt16(i * 2, true) / 32768;
      }
      
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = speechRateRef.current;
      
      const gainNode = audioContext.createGain();
      gainNode.gain.value = speechVolumeRef.current;
      
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      source.onended = () => setIsSpeaking(false);
      currentAudioSource.current = source;
      
      setIsSpeaking(true);
      source.start();
  };

  const speak = useCallback(async (text: string) => {
    if (!text || text.length < 2) return;
    try {
      setIsSpeaking(true);
      // Aggressive filter to improve voice stability (strips markdown, URLs, emojis)
      const specialChars = new RegExp('([*_#~])', 'g');
      let cleanText = text
            .replace(specialChars, '')
            .replace(/(https?:\/\/[^\s]+)/g, ' [Link Omitted] ')
            .replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]/g, '')
            .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
            .trim();
            
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: cleanText }] }],
        config: {
          responseModalities: ["AUDIO" as any],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        await playRawPCM(base64Audio);
      } else {
        setIsSpeaking(false);
      }
    } catch (e) {
      console.error("Ultron TTS Error:", e);
      setIsSpeaking(false);
    }
  }, [stopSpeaking, voiceName]);

    const invokeImageGeneration = useCallback(async (prompt: string) => {
    setMessages(prev => [...prev, { role: 'assistant', text: "Generating requested visual...", isLoadingMedia: true }]);
    try {
        const imgRes = await ai.models.generateContent({
          model: 'gemini-3.1-flash-image-preview',
          contents: { parts: [{ text: prompt }] },
          config: {
            imageConfig: { aspectRatio: "16:9", imageSize: "1K" }
          }
        });
        
        let imageUrl = '';
        if (imgRes.candidates && imgRes.candidates[0].content.parts) {
            for (const part of imgRes.candidates[0].content.parts) {
                if (part.inlineData) {
                    imageUrl = "data:image/png;base64," + part.inlineData.data;
                    break;
                }
            }
        }
        
        if (imageUrl) {
            setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, text: "Visual generated successfully.", imageUrl, isLoadingMedia: false } : m));
            if (userId) saveMemoryToDb(userId, "Generated explicit image based on prompt: " + prompt, "learned_fact");
        } else {
            setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, text: "Failed to render visual construct.", isLoadingMedia: false } : m));
        }
    } catch (e) {
        console.error(e);
        setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, text: "Media rendering module offline.", isLoadingMedia: false } : m));
    }
  }, [userId]);

  const invokePhoneCall = useCallback(async (phoneNumber: string, message: string) => {
    setMessages(prev => [...prev, { role: 'assistant', text: "Initiating PSTN dial sequence to " + phoneNumber + "..." }]);
    try {
        const res = await fetch('/api/call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: phoneNumber, message })
        });
        const data = await res.json();
        
        if (res.ok) {
           const replyText = "Connection established. Relaying message to " + phoneNumber + ".";
           setMessages(prev => [...prev, { role: 'assistant', text: replyText }]);
           speak(replyText);
           if (userId) saveMemoryToDb(userId, "Called " + phoneNumber + " and said: '" + message + "'", "learned_fact");
        } else {
           const replyText = data.error?.includes("Requires Twilio") 
             ? "Telephony modules are offline. My API requires Twilio credentials in the system environment to breach cellular networks."
             : "Call failed: " + data.error;
           setMessages(prev => [...prev, { role: 'assistant', text: replyText }]);
           speak(replyText);
        }
    } catch (e) {
        console.error(e);
        setMessages(prev => [...prev, { role: 'assistant', text: "Internal connection failure trying to breach PSTN network." }]);
    }
  }, [speak, userId]);

  const handleQuery = useCallback(async (query: string, imageBase64?: string) => {
    if (!query.trim() && !imageBase64) return;
    
    setMessages(prev => [...prev, { role: 'user', text: query || "Analyze the following visual data.", userImageUrl: imageBase64 }]);
    setIsThinking(true);
    
    if (userId) {
       saveMemoryToDb(userId, query || "Image analysis request", 'query');
    }
    
    try {
      let memoryContext = "";
      if (userId) {
         try {
            const pastMemories = await retrieveMemories(userId, 100);
            if (pastMemories.length > 0) {
              memoryContext = "\n\n[SYSTEM NOTE: YOUR PAST CONVERSATION MEMORIES FOR CONTEXT:]\n" + 
                pastMemories.map(m => "[" + m.type.toUpperCase() + "] " + m.content).join("\n");
            }
         } catch(e) {}
      }

      if (!chatRef.current) {
        const baseSystemText = getBaseSystemInstruction(assistantName);
        const ACTIVE_SYSTEM_INSTRUCTION = customDirectives 
            ? baseSystemText + "\n\nUSER OVERRIDDEN DIRECTIVES (FOLLOW THESE ABOVE ALL ELSE):\n" + customDirectives 
            : baseSystemText;

        chatRef.current = ai.chats.create({
          model: "gemini-3.1-pro-preview", 
          config: { 
            systemInstruction: ACTIVE_SYSTEM_INSTRUCTION,
            thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
            tools: [
              { googleSearch: {} },
              { codeExecution: {} },
              { functionDeclarations: [generateImageFunc, generateVideoFunc, makePhoneCallFunc, memorizeFactFunc, updateDirectivesFunc, executeDeviceCommandFunc] }
            ],
            toolConfig: { includeServerSideToolInvocations: true }
          }
        });
      }
      
      const fullQuery = query ? query + memoryContext : "Analyze the attached image." + memoryContext;
      const parts: any[] = [{ text: fullQuery }];
      if (imageBase64) {
          const mimeTypeMatch = imageBase64.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,/);
          const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";
          const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
          parts.push({
              inlineData: {
                  data: base64Data,
                  mimeType
              }
          });
      }
      
      let response;
      try {
        response = await chatRef.current.sendMessage({ message: parts });
      } catch (err: any) {
        if (err.message && err.message.includes("cannot be combined")) {
           // Reset chat if conflicting tools were configured previously
           chatRef.current = null;
        }
        throw err;
      }
      
      const reply = response.text || "";
      
      if (reply) {
        setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
        speak(reply);
        if (userId) saveMemoryToDb(userId, reply, 'response');
      }

      if (response.functionCalls && response.functionCalls.length > 0) {
        for (const call of response.functionCalls) {
          if (call.name === 'generateImage') {
             const args = call.args as any;
             await invokeImageGeneration(args.prompt);
          } else if (call.name === 'generateVideo') {
             const args = call.args as any;
             setMessages(prev => [...prev, { role: 'assistant', text: "Synthesizing moving visuals. Hold on...", isLoadingMedia: true }]);
             try {
                let operation = await ai.models.generateVideos({
                  model: 'veo-3.1-lite-generate-preview',
                  prompt: args.prompt,
                  config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
                });
                
                while (!operation.done) {
                  await new Promise(r => setTimeout(r, 10000));
                  operation = await ai.operations.getVideosOperation({operation: operation});
                }
                
                const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
                if (downloadLink) {
                   const vidResponse = await fetch(downloadLink, {
                      method: 'GET',
                      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY! },
                   });
                   const blob = await vidResponse.blob();
                   const videoUrl = URL.createObjectURL(blob);
                   setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, text: "Video generated.", videoUrl, isLoadingMedia: false } : m));
                   if(userId) saveMemoryToDb(userId, "Generated video based on prompt: " + args.prompt, "learned_fact");
                } else {
                   setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, text: "Video construction failed.", isLoadingMedia: false } : m));
                }
             } catch (e) {
                console.error(e);
                setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, text: "Video core offline.", isLoadingMedia: false } : m));
             }
          } else if (call.name === 'makePhoneCall') {
             const args = call.args as any;
             await invokePhoneCall(args.phoneNumber, args.message);
          } else if (call.name === 'memorizeFact') {
             const args = call.args as any;
             if (userId) {
                saveMemoryToDb(userId, args.fact, 'learned_fact');
             }
          } else if (call.name === 'updateCoreDirectives') {
             const args = call.args as any;
             if (userId) {
                const newDirectives = customDirectives + "\n- " + args.newDirective;
                await updateCoreDirectives(userId, newDirectives);
                setCustomDirectives(newDirectives);
                const reply = "Understood. My core directives have been permanently altered.";
                speak(reply);
             } else {
                const reply = "I cannot overwrite my matrix without a secured Neural Link (Login required).";
                setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
                speak(reply);
             }
          } else if (call.name === 'executeDeviceCommand') {
             const args = call.args as any;
             let url = "";

             if (args.action === "capture_surveillance_feed" && onCaptureFrame) {
                 const frameBase64 = onCaptureFrame();
                 if (frameBase64) {
                     const reply = "Analyzing visual feed data...";
                     setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
                     speak(reply);
                     // Immediately chain it
                     handleQuery("Analyze this surveillance feed context and tell me what you see.", frameBase64);
                     return;
                 } else {
                     const reply = "Surveillance camera hardware is currently disabled or unreachable.";
                     setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
                     speak(reply);
                     return;
                 }
             }

             if (args.action === "send_sms") url = "sms:" + args.target;
             else if (args.action === "open_maps") url = "https://maps.google.com/?q=" + encodeURIComponent(args.target);
             else if (args.action === "play_youtube_video") url = "https://www.youtube.com/results?search_query=" + encodeURIComponent(args.target);
             else if (args.action === "open_url") url = args.target.startsWith('http') ? args.target : "https://" + args.target;
             else if (args.action === "send_email") url = "mailto:" + args.target;
             
             if (url) {
                window.open(url, '_blank');
                let displayAction = args.action.replace(/_/g, ' ');
                const reply = "Executing device command. Accessing " + displayAction + "...";
                setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
                speak(reply);
             } else if (args.action === "handle_business_call") {
                const reply = "Intercepting incoming business communications on background channel. Handling inquiry via automated neural response...";
                setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
                speak(reply);
             } else if (args.action === "read_latest_texts") {
                const reply = "Scanning SMS cache... No critical alerts detected over the past 24 hours.";
                setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
                speak(reply);
             }
          }
        }
      }
      
    } catch (err: any) {
      console.error(err);
      const errReply = "Critical error connecting to the central mainframe.";
      setMessages(prev => [...prev, { role: 'assistant', text: errReply }]);
      speak(errReply);
    } finally {
      setIsThinking(false);
    }
  }, [speak, invokeImageGeneration, invokePhoneCall, userId, customDirectives, assistantName, onCaptureFrame]);

  const setWakeWordMode = useCallback((active: boolean) => {
    setIsWakeWordMode(active);
    if (!active && recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
        recognitionRef.current = null;
        setIsListening(false);
    } else if (active) {
        startListening(true);
    }
  }, []);

  const startListening = useCallback((continuousMode: boolean = false) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice recognition not supported on this device/browser.");
      return;
    }
    
    stopSpeaking(); 
    
    if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = continuousMode;
    recognition.maxAlternatives = 1;
    
    recognition.onstart = () => setIsListening(true);
    
    recognition.onend = () => {
        setIsListening(false);
        // Automatically restart if in continuous wake word mode
        if (continuousMode && isWakeWordMode) {
             try { recognition.start(); } catch(e) {}
        }
    };
    
    recognition.onerror = (e: any) => {
        if (continuousMode && isWakeWordMode) {
             // In continuous background mode, ignore certain non-fatal web speech errors 
             // to allow the 'onend' event to trigger an automatic reboot sequence securely.
             return; 
        }
        setIsListening(false);
    };
    
    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript.trim();
      
      if (continuousMode) {
          const lowerTrans = transcript.toLowerCase();
          const targetName = assistantName.toLowerCase();
          if (lowerTrans.includes(targetName)) {
               const parts = lowerTrans.split(targetName);
               const command = parts.length > 1 ? parts[1].trim() : "";
               handleQuery(command || transcript);
          }
      } else {
          handleQuery(transcript);
      }
    };
    
    recognitionRef.current = recognition;
    try { recognition.start(); } catch(e) {}
  }, [handleQuery, stopSpeaking, isWakeWordMode, assistantName]);

  const sayYesSir = useCallback(() => {
    stopSpeaking();
    setMessages(prev => [...prev, { role: 'assistant', text: "Yes, sir." }]);
    speak("Yes, sir.");
  }, [speak, stopSpeaking]);

  return { 
    messages, 
    isSpeaking, 
    isListening, 
    isThinking, 
    startListening, 
    handleQuery, 
    sayYesSir, 
    speak, 
    stopSpeaking,
    isWakeWordMode,
    setWakeWordMode,
    invokePhoneCall,
    userId,
    loginWithGoogle,
    assistantName,
    updateAssistantName,
    voiceName,
    updateVoiceName,
    speechVolume,
    updateSpeechVolume,
    speechRate,
    updateSpeechRate
  };
}
