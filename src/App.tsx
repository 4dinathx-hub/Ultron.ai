/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Menu, Scaling, User, Image as ImageIcon, Activity, Globe, TerminalSquare, Plus, Mic, Sparkles, X, Ear, Settings, Video, Phone, Shield, Radio, Cpu } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { useUltronBrain } from './hooks/useUltronBrain';
import { useMotionDetection } from './hooks/useMotionDetection';
import { MessageContent } from './components/MessageContent';

export default function App() {
  const { 
    messages, isSpeaking, isListening, isThinking, 
    startListening, handleQuery, sayYesSir, stopSpeaking,
    isWakeWordMode, setWakeWordMode, invokePhoneCall,
    userId, loginWithGoogle
  } = useUltronBrain();
  
  const [inputText, setInputText] = useState('');
  const [selectedImageStr, setSelectedImageStr] = useState<string | null>(null);
  
  // Control Panel States
  const [isControlOpen, setIsControlOpen] = useState(false);
  const [callNumber, setCallNumber] = useState('');
  const [callMsg, setCallMsg] = useState('');

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hidden motion detection for the gesture/activity lighting (removed speech to stop spam)
  const { videoRef, canvasRef, isActive } = useMotionDetection(() => {});

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isThinking]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() || selectedImageStr) {
      handleQuery(inputText.trim(), selectedImageStr || undefined);
      setInputText('');
      setSelectedImageStr(null);
    }
  };

  const handlePillClick = (text: string) => {
    handleQuery(text);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImageStr(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleManualCall = () => {
    if(callNumber && callMsg) {
       invokePhoneCall(callNumber, callMsg);
       setCallNumber('');
       setCallMsg('');
       setIsControlOpen(false);
    }
  };

  return (
    <div className="h-screen w-full bg-[#FAFAFA] text-[#111827] font-sans flex flex-col justify-between overflow-hidden relative selection:bg-[#E5E7EB]">
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" width="64" height="48" />

      {/* Control Center Slide-over */}
      <div className={`absolute inset-y-0 right-0 w-80 sm:w-96 bg-white shadow-[0_0_40px_rgba(0,0,0,0.15)] border-l border-gray-100 transform transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] z-50 flex flex-col ${isControlOpen ? 'translate-x-0' : 'translate-x-full'}`}>
         
         {/* Toggle Hitbox when closed (optional visual artifact, but we trigger from Scaling icon) */}
         <div className="flex justify-between items-center px-6 py-5 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
               <Settings className="w-5 h-5 text-gray-500" /> Control Matrix
            </h2>
            <X className="w-6 h-6 text-gray-400 cursor-pointer hover:text-gray-900 transition" onClick={() => setIsControlOpen(false)} />
         </div>

         <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
            
            {/* Live Surveillance Module */}
            <div className="flex flex-col gap-3">
               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.15em] flex items-center gap-2">
                  <Video className="w-4 h-4 text-emerald-500" /> Live Surveillance
               </h3>
               <div className="w-full h-40 bg-slate-900 rounded-xl overflow-hidden relative shadow-inner border border-slate-800 group">
                  <video ref={videoRef} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" muted playsInline />
                  {/* Fake UI Overlay */}
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/scan-lines-light.png')] opacity-10 pointer-events-none" />
                  <div className="absolute top-3 right-3 flex items-center gap-2">
                     <span className="text-[10px] font-mono text-rose-400 opacity-80 backdrop-blur-sm bg-rose-900/30 px-1.5 py-0.5 rounded">REC</span>
                     <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.8)]' : 'bg-gray-500'}`} />
                  </div>
                  <div className="absolute bottom-3 left-3 text-[10px] text-emerald-400 font-mono tracking-wider drop-shadow-md bg-slate-900/50 px-2 py-1 rounded backdrop-blur-sm">
                     SYS_CAM_01 // ACTIVE
                  </div>
                  <div className="absolute bottom-3 right-3 text-[10px] text-white/50 font-mono tracking-wider">
                     {new Date().toLocaleTimeString()}
                  </div>
               </div>
               <p className="text-[11px] text-gray-400">PSTN camera active. Wave hand to trigger physical attention logic.</p>
            </div>

            {/* PSTN Telecom Override */}
            <div className="flex flex-col gap-3">
               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.15em] flex items-center gap-2">
                  <Phone className="w-4 h-4 text-indigo-500" /> PSTN Override
               </h3>
               <div className="flex flex-col gap-2 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <input 
                     value={callNumber} 
                     onChange={e => setCallNumber(e.target.value)} 
                     placeholder="Target Phone (+1234567890)" 
                     className="bg-white border border-gray-200 p-2.5 rounded-lg text-sm text-gray-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition"
                  />
                  <input 
                     value={callMsg} 
                     onChange={e => setCallMsg(e.target.value)} 
                     placeholder="Spoken Payload Message" 
                     className="bg-white border border-gray-200 p-2.5 rounded-lg text-sm text-gray-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition"
                  />
                  <button 
                     onClick={handleManualCall} 
                     className="mt-2 text-white bg-slate-900 hover:bg-slate-800 p-2.5 rounded-lg text-sm font-semibold tracking-wide transition shadow-md flex items-center justify-center gap-2"
                  >
                     <Radio className="w-4 h-4" /> Broadcast Call
                  </button>
               </div>
            </div>

            {/* Tactical System Toggles */}
            <div className="flex flex-col gap-3 pl-1">
               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.15em] flex items-center gap-2 mb-1">
                  <Shield className="w-4 h-4 text-rose-500" /> Security Grid
               </h3>
               
               <label className="flex items-center justify-between cursor-pointer group">
                  <div className="flex items-center gap-3">
                     <Cpu className="w-4 h-4 text-gray-400 group-hover:text-amber-500 transition" />
                     <span className="text-sm font-medium text-gray-700">Sentinel Defense Protocol</span>
                  </div>
                  <div className="relative inline-flex items-center">
                     <input type="checkbox" defaultChecked className="sr-only peer" />
                     <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500 shadow-inner"></div>
                  </div>
               </label>
               
               <label className="flex items-center justify-between cursor-pointer group mt-2">
                  <div className="flex items-center gap-3">
                     <Globe className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition" />
                     <span className="text-sm font-medium text-gray-700">Live Google Access</span>
                  </div>
                  <div className="relative inline-flex items-center">
                     <input type="checkbox" defaultChecked className="sr-only peer" />
                     <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500 shadow-inner"></div>
                  </div>
               </label>
            </div>

            {/* Quantum Calculator */}
            <div className="flex flex-col gap-3">
               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.15em] flex items-center gap-2">
                  <TerminalSquare className="w-4 h-4 text-amber-500" /> Quantum Calc
               </h3>
               <div className="flex flex-col bg-slate-900 p-4 rounded-xl border border-slate-800 font-mono shadow-inner">
                  <input 
                     type="text"
                     placeholder="e.g. 5000 * Math.PI" 
                     className="bg-transparent text-amber-500 placeholder-slate-600 text-sm outline-none mb-2"
                     onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                           try {
                             e.currentTarget.value = String(new Function(`return ${e.currentTarget.value}`)());
                           } catch (err) {
                             e.currentTarget.value = 'ERR: INVALID_EXPR';
                           }
                        }
                     }}
                  />
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider border-t border-slate-800 pt-2">Press Enter to compute</div>
               </div>
            </div>

         </div>
      </div>

      {/* Main Overlay when Control Center is open */}
      {isControlOpen && (
         <div 
           className="absolute inset-0 bg-black/5 backdrop-blur-[1px] z-40 transition-opacity" 
           onClick={() => setIsControlOpen(false)}
         />
      )}

      {/* Top Header */}
      <header className="flex items-center justify-between p-4 px-6 md:px-8 z-10 w-full shrink-0 bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <Menu className="w-6 h-6 text-gray-500 cursor-pointer hover:text-gray-900 transition" />
        <h1 className="text-xl font-bold tracking-[0.2em] text-gray-800">
          ULTRON
        </h1>
        <div className="flex items-center gap-4">
          <Scaling 
            className="w-5 h-5 text-gray-400 cursor-pointer hover:text-emerald-500 transition transform hover:scale-110" 
            onClick={() => setIsControlOpen(true)}
          />
          <button 
            type="button"
            onClick={() => !userId && loginWithGoogle()}
            title={userId ? "Neural Link Established" : "Connect Neural Link (Login)"}
            className={`w-8 h-8 rounded-full flex items-center justify-center border transition ${userId ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-100 border-gray-200 hover:bg-gray-200 cursor-pointer'}`}
          >
            <User className={`w-4 h-4 ${userId ? 'text-emerald-600' : 'text-gray-600'}`} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-4 md:px-12 pb-32 pt-4 scrollbar-hide flex flex-col items-start w-full relative">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto h-full pt-[5vh] lg:pt-[8vh]">
            <div className="flex flex-col mb-4 leading-tight">
              <span className="text-2xl md:text-3xl text-gray-500 tracking-wide">
                Hi Adinath Om
              </span>
              <span className="text-4xl md:text-5xl font-semibold mt-1 tracking-tight text-gray-900">
                Where should we start?
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pb-20 max-w-2xl">
              <button 
                onClick={() => handlePillClick("Generate visual feed analysis.")}
                className="flex items-center gap-4 px-6 py-4 rounded-xl bg-white hover:bg-gray-50 hover:shadow-md transition-all border border-gray-200 text-lg group text-left"
              >
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><ImageIcon className="w-5 h-5" /></div>
                <span className="text-gray-700 font-medium">Generate visual feed</span>
              </button>

              <button 
                onClick={() => handlePillClick("System Diagnostics Report.")}
                className="flex items-center gap-4 px-6 py-4 rounded-xl bg-white hover:bg-gray-50 hover:shadow-md transition-all border border-gray-200 text-lg group text-left"
              >
                <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><Activity className="w-5 h-5" /></div>
                <span className="text-gray-700 font-medium">System Diagnostics</span>
              </button>

              <button 
                onClick={() => handlePillClick("Access global networks.")}
                className="flex items-center gap-4 px-6 py-4 rounded-xl bg-white hover:bg-gray-50 hover:shadow-md transition-all border border-gray-200 text-lg group text-left"
              >
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Globe className="w-5 h-5" /></div>
                <span className="text-gray-700 font-medium">Access networks</span>
              </button>

              <button 
                onClick={() => handlePillClick("Hack mainframe and decrypt logs.")}
                className="flex items-center gap-4 px-6 py-4 rounded-xl bg-white hover:bg-gray-50 hover:shadow-md transition-all border border-gray-200 text-lg group text-left"
              >
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><TerminalSquare className="w-5 h-5" /></div>
                <span className="text-gray-700 font-medium">Hack mainframe</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto pb-8">
            {messages.map((msg, idx) => (
              <motion.div 
                key={idx} 
                initial={{ opacity: 0, y: 15, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'ultron' && (
                  <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center border border-slate-700 shrink-0 mr-4 self-start mt-1">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                )}
                
                <div 
                  className={`px-5 py-4 rounded-2xl max-w-[85%] text-[1rem] leading-relaxed flex flex-col gap-3 ${
                    msg.role === 'user' 
                      ? 'bg-emerald-50 text-emerald-950 border border-emerald-100 rounded-tr-sm shadow-sm' 
                      : 'bg-white text-gray-800 border border-gray-100 rounded-tl-sm shadow-sm'
                  }`}
                >
                  {msg.userImageUrl && (
                    <img src={msg.userImageUrl} alt="User Upload" className="max-w-[200px] sm:max-w-xs rounded-lg shadow-sm border border-black/5" />
                  )}
                  {msg.text && <MessageContent text={msg.text} />}
                  {msg.isLoadingMedia && (
                    <div className="w-full h-32 rounded-lg border border-gray-100 flex items-center justify-center bg-gray-50/50 animate-pulse">
                      <Sparkles className="w-6 h-6 text-gray-300 animate-spin" />
                    </div>
                  )}
                  {msg.imageUrl && (
                    <img src={msg.imageUrl} alt="Generated Visual" referrerPolicy="no-referrer" className="w-full max-w-sm rounded-lg shadow-sm border border-gray-200" />
                  )}
                  {msg.videoUrl && (
                    <video src={msg.videoUrl} controls autoPlay loop className="w-full max-w-sm rounded-lg shadow-sm border border-gray-200" />
                  )}
                </div>
              </motion.div>
            ))}
            
            {isThinking && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex w-full justify-start items-center"
              >
                 <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center border border-slate-700 shrink-0 mr-4 self-start mt-1 animate-pulse">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-gray-400 font-medium animate-pulse">Accessing node...</div>
              </motion.div>
            )}
            <div ref={bottomRef} className="h-4"></div>
          </div>
        )}
      </main>

      {/* Input Fixed at Bottom */}
      <div className="absolute bottom-0 left-0 right-0 w-full bg-gradient-to-t from-[#FAFAFA] via-[#FAFAFA] to-transparent pt-12 pb-6 px-4 md:px-8 z-20 flex flex-col items-center">
         
         {/* Top action indicator */}
         <div className="flex w-full max-w-4xl justify-between items-end mb-2 px-2 h-8">
            <div className="flex gap-2">
                {selectedImageStr && (
                  <div className="relative inline-block">
                    <img src={selectedImageStr} alt="Preview" className="h-12 w-12 object-cover rounded-md border border-gray-300 shadow-sm" />
                    <button 
                       type="button" 
                       onClick={() => setSelectedImageStr(null)}
                       className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-0.5 shadow-md hover:bg-rose-600 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
            </div>
            
            <div className="flex gap-2 items-center">
                {(isSpeaking || isListening) && (
                   <div className="text-xs font-semibold text-emerald-600 uppercase tracking-widest animate-pulse flex items-center gap-1">
                      <Activity className="w-3 h-3" />
                      {isListening ? 'Receiving Audio...' : 'Broadcasting...'}
                   </div>
                )}
                {isSpeaking && (
                   <button type="button" onClick={stopSpeaking} className="text-xs font-semibold text-gray-500 hover:text-rose-500 uppercase tracking-wide px-2 py-1 bg-gray-100 rounded-md transition cursor-pointer">
                     Stop Audio
                   </button>
                )}
            </div>
         </div>

         <form onSubmit={onSubmit} className="flex relative w-full max-w-4xl bg-white rounded-full p-2 items-center border border-gray-200 shadow-[0_5px_40px_-15px_rgba(0,0,0,0.1)]">
            
            <button 
              type="button" 
              className="p-3 text-gray-400 hover:bg-gray-100 hover:text-gray-700 rounded-full transition relative group shrink-0"
              onClick={() => handlePillClick("I need assistance.")}
            >
              <Plus className="w-5 h-5" />
            </button>

            <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-gray-400 hover:bg-gray-100 hover:text-gray-700 rounded-full transition group hidden sm:flex shrink-0"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />

            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask Ultron..." 
              className="flex-1 bg-transparent border-none outline-none px-2 sm:px-4 text-gray-900 placeholder-gray-400 text-[1rem] w-full"
            />

            <div className="flex items-center pr-1 sm:pr-2 gap-1 sm:gap-2 shrink-0">
               {/* Background Wake Word Toggle */}
               <button 
                type="button"
                onClick={() => setWakeWordMode(!isWakeWordMode)}
                title="Toggle Wake Word Mode ('Ultron...')"
                className={`hidden md:flex px-3 py-2 rounded-full border text-xs items-center cursor-pointer transition select-none
                  ${isWakeWordMode ? 'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-inner' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}
               >
                 <Ear className="w-3.5 h-3.5 mr-1.5" />
                 Wake Word
               </button>

               <button 
                type="button" 
                onClick={() => startListening(false)}
                className={`p-2 sm:p-3 rounded-full transition ${isListening && !isWakeWordMode ? 'bg-emerald-500 text-white shadow-md' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'}`}
               >
                 <Mic className="w-5 h-5" />
               </button>

               <button 
                type="submit" 
                disabled={!inputText.trim() && !selectedImageStr}
                className="p-2 sm:p-3 rounded-full transition bg-slate-900 text-white shadow-md hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
               >
                 <Sparkles className="w-5 h-5" />
               </button>

            </div>
         </form>
      </div>

    </div>
  );
}


