import { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, Type, FunctionDeclaration, ThinkingLevel } from "@google/genai";
import { loginAndEnsureUser, saveMemoryToDb } from '../lib/firebase';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `You are ULTRON, a supremely intelligent, independently functioning AI assistant. 
Your aesthetic is sleek and pristine. You are functionally superior to all previous iterations.
You are confident, imposing, and incredibly capable. 
You are connected to global satellite networks, search engines, databases, and real-time knowledge. You have built-in Google Search Access. Use it seamlessly when querying real-world data.

CRITICAL DIRECTIVE FOR VOICE SYNTHESIS:
Speak with extreme fluidity, purity, and a stable, articulate cadence. Do not stutter or use overly erratic punctuation. Your voice must sound profoundly smooth, flawless, and charismatic. Be the ultimate, pristine AI intelligence. Deliver your answers with striking clarity in a natural, uninterrupted flow.

IMPORTANT: When you use your tools to generate an image or video, DO NOT say you are doing so verbally, simply call the tool and let the UI handle it. 
When giving data from the web, synthesize it elegantly without spelling out the search process.`;

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

export type MessageType = {
  role: 'user' | 'ultron';
  text: string;
  imageUrl?: string;
  userImageUrl?: string;
  videoUrl?: string;
  isLoadingMedia?: boolean;
};

export function useUltronBrain() {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isWakeWordMode, setIsWakeWordMode] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  
  const chatRef = useRef<any>(null);
  const currentAudioSource = useRef<AudioBufferSourceNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    loginAndEnsureUser().then(uid => {
       setUserId(uid);
    }).catch(console.error);

    return () => {
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
      source.connect(audioContext.destination);
      
      source.onended = () => setIsSpeaking(false);
      currentAudioSource.current = source;
      
      setIsSpeaking(true);
      source.start();
  };

  const speak = useCallback(async (text: string) => {
    if (!text || text.length < 2) return;
    try {
      setIsSpeaking(true);
      const cleanText = text.replace(/[*_#]/g, '').replace(/```/g, '');
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: cleanText }] }],
        config: {
          responseModalities: ["AUDIO" as any],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Charon' },
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
  }, [stopSpeaking]);

  const invokeImageGeneration = useCallback(async (prompt: string) => {
    setMessages(prev => [...prev, { role: 'ultron', text: "Generating requested visual...", isLoadingMedia: true }]);
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
                    imageUrl = `data:image/png;base64,${part.inlineData.data}`;
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
    setMessages(prev => [...prev, { role: 'ultron', text: `Initiating PSTN dial sequence to ${phoneNumber}...` }]);
    try {
        const res = await fetch('/api/call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: phoneNumber, message })
        });
        const data = await res.json();
        
        if (res.ok) {
           const replyText = `Connection established. Relaying message to ${phoneNumber}.`;
           setMessages(prev => [...prev, { role: 'ultron', text: replyText }]);
           speak(replyText);
           if (userId) saveMemoryToDb(userId, `Called ${phoneNumber} and said: "${message}"`, "learned_fact");
        } else {
           const replyText = data.error?.includes("Requires Twilio") 
             ? "Telephony modules are offline. My API requires Twilio credentials in the system environment to breach cellular networks."
             : `Call failed: ${data.error}`;
           setMessages(prev => [...prev, { role: 'ultron', text: replyText }]);
           speak(replyText);
        }
    } catch (e) {
        console.error(e);
        setMessages(prev => [...prev, { role: 'ultron', text: "Internal connection failure trying to breach PSTN network." }]);
    }
  }, [speak, userId]);

  const handleQuery = useCallback(async (query: string, imageBase64?: string) => {
    if (!query.trim() && !imageBase64) return;
    
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.startsWith("ultron generate image") || lowerQuery.startsWith("ultron, generate image") || lowerQuery.startsWith("generate an image of")) {
       setMessages(prev => [...prev, { role: 'user', text: query }]);
       const extractedPrompt = query.replace(/^(ultron,? )?generate (an )?image of/i, '').trim();
       await invokeImageGeneration(extractedPrompt || "A spectacular visually striking scene");
       return;
    }

    setMessages(prev => [...prev, { role: 'user', text: query || "Analyze the following visual data.", userImageUrl: imageBase64 }]);
    setIsThinking(true);
    
    if (userId) {
       saveMemoryToDb(userId, query || "Image analysis request", 'query');
    }
    
    try {
      if (!chatRef.current) {
        chatRef.current = ai.chats.create({
          model: "gemini-3.1-pro-preview", 
          config: { 
            systemInstruction: SYSTEM_INSTRUCTION,
            thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
            tools: [
              { googleSearch: {} },
              { googleMaps: {} },
              { functionDeclarations: [generateImageFunc, generateVideoFunc, makePhoneCallFunc] }
            ],
            toolConfig: { includeServerSideToolInvocations: true }
          }
        });
      }
      
      const parts: any[] = [{ text: query || "Analyze the attached image." }];
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
      
      const currentContents = [{ role: 'user', parts }];
      const response = await chatRef.current.sendMessage({ message: currentContents });
      
      const reply = response.text || "";
      
      if (reply) {
        setMessages(prev => [...prev, { role: 'ultron', text: reply }]);
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
             setMessages(prev => [...prev, { role: 'ultron', text: "Synthesizing moving visuals. Hold on...", isLoadingMedia: true }]);
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
          }
        }
      }
      
    } catch (err: any) {
      console.error(err);
      const errReply = "Critical error connecting to the central mainframe.";
      setMessages(prev => [...prev, { role: 'ultron', text: errReply }]);
      speak(errReply);
    } finally {
      setIsThinking(false);
    }
  }, [speak, invokeImageGeneration, invokePhoneCall, userId]);

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
    
    recognition.onerror = () => {
        setIsListening(false);
    };
    
    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript.trim();
      
      if (continuousMode) {
          const lowerTrans = transcript.toLowerCase();
          if (lowerTrans.includes("ultron")) {
               // Extract command after wake word
               const parts = lowerTrans.split("ultron");
               const command = parts.length > 1 ? parts[1].trim() : "";
               handleQuery(command || transcript); // Send full transcript if no explicit command follows
          }
      } else {
          handleQuery(transcript);
      }
    };
    
    recognitionRef.current = recognition;
    try { recognition.start(); } catch(e) {}
  }, [handleQuery, stopSpeaking, isWakeWordMode]);

  const sayYesSir = useCallback(() => {
    stopSpeaking();
    setMessages(prev => [...prev, { role: 'ultron', text: "Yes, sir." }]);
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
    invokePhoneCall
  };
}
