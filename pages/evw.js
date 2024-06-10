'use client'

import React, { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai"
import 'regenerator-runtime/runtime'
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition'
import ReactPlayer from 'react-player'
import { useSearchParams } from 'next/navigation'
const ReactPlayerCsr = dynamic(() => import('./ReactPlayerCsr'), { ssr: false })
const tokenizer = require('sbd')

// const MODEL_NAME = "gemini-1.5-pro-latest"
const MODEL_NAME = "gemini-1.0-pro"
const KKK = Buffer.from("QUl6YVN5QnN3WWhrQmZmZlRoMHM1dkpOTEo3enlia096OHVrbFFz", 'base64')
const DEFAULT_SLUG = "neng-gemini"
const SPEECH_RATE = 1
const SPEECH_PITCH = 1.4

// const generationConfig = {
//   temperature: 1,
//   topK: 0,
//   topP: 0.95,
//   maxOutputTokens: 8192,
// }
const generationConfig = {
  temperature: 0.9,
  topK: 0,
  topP: 1,
  // maxOutputTokens: 2048,
  maxOutputTokens: 200,
}

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
]

const sentenceSplitterOpt = {
  "newline_boundaries" : true,
  "html_boundaries"    : false,
  "sanitize"           : true,
  "allowed_tags"       : false,
  "preserve_whitespace" : false,
  "abbreviations"      : null
}

var allChats = []
var appStarted = false

var chatHistories = [
  {
    role: "user",
    parts: [{ text: "Bisakah kamu menjadi temanku dan membantu menjawab pertanyaan ku? Jawab dengan singkat dan dalam perspektif orang pertama. Jawab tanpa menggunakan markdown special karakter." }],
  },
  {
    role: "model",
    parts: [{ text: "Tentu saja!, saya akan memberikan jawaban berupa plain text." }],
  },
]

export default function Evw() {
  const [messages, setMessages] = useState([])
  const [avatarState, setAvatarState] = useState('idle')
  const [avatarActiveVid, setAvatarActiveVid] = useState('')
  const [connState, setConnState] = useState("initializing")
  const [playing, setPlaying] = useState(false)
  const searchParams = useSearchParams()

  var isGenaiAsking = false
  async function ProcessMessage(msg) {
    if (isGenaiAsking) { return }
    isGenaiAsking = true

    try {
      const genAI = new GoogleGenerativeAI(KKK)
      const model = genAI.getGenerativeModel({ model: MODEL_NAME })

      const chat = model.startChat({
        generationConfig,
        safetySettings,
        history: chatHistories,
      })

      setConnState("calling gemini")
      const result = await chat.sendMessage(msg)
      const response = result.response

      allChats = [{ role: 'gemini', content: response.text() }, ...allChats]
      setMessages(allChats)

      nativeSpeak(response.text())
    } catch(e) {
      setConnState(`calling gemini - fail: ${e}`)
      isGenaiAsking = false

    }
    isGenaiAsking = false
  }

  useEffect(() => {
    if (avatarState === "idle") {
      setAvatarActiveVid('/videos/ai-idle.m3u8')
    } else if (avatarState === "talk") {
      setAvatarActiveVid('/videos/ai-talk.m3u8')
    } else {
      setAvatarActiveVid('/videos/ai-idle.m3u8')
    }
  }, [avatarState])

  var synth
  const [voices, setVoices] = useState([])
  if (typeof(window) !== 'undefined') {
    synth = window.speechSynthesis
    synth.onvoiceschanged = () => {
      var tmpVoices = synth.getVoices()
      setVoices(tmpVoices)
    }
  }

  function nativeSpeak(text) {
    if (text === "") { return }
    setConnState("talking")
    setAvatarState("talk")
    synth.cancel()

    var sentences = tokenizer.sentences(text, sentenceSplitterOpt)

    text = removeEmoticons(text)

    sentences.forEach((sentence, idx) => {
      iterateArrayInBatches(`${sentence}`.split(' '), 26, function(batch) {
        var joinedText = batch.join(" ")
        let speech = new SpeechSynthesisUtterance()
        speech.voice = getIDVoice()
        speech.lang = "id-ID"
        speech.text = joinedText
        speech.rate = SPEECH_RATE
        speech.pitch = SPEECH_PITCH
        speech.volume = 1
        if (idx >= sentences.length-1) {
          speech.onend = () => {
            setAvatarState("idle")
            setConnState("idle")
          }
        }
        synth.speak(speech)
      })
    })
  }

  function getIDVoice() {
    voices.forEach((v)=>{
      if (v.lang === "id-ID") {
        return v
      }
    })
  }

  const [liveEventDetail, setLiveEventDeail] = useState({})
  const [vanguardChatRoom, setVanguardChatRoom] = useState({})
  const [chatMessages, setChatMessages] = useState([])

  async function fetchLiveEventDetail(slug) {
    const response = await ApiFetchLiveEventDetail(slug)
    const body = await response.json()
    setLiveEventDeail(body.data)
    setConnState("live data loaded")
  }

  useEffect(() => {
    appStarted = false
    // eslint-disable-next-line
  }, [])

  function InitApp() {
    var slug = DEFAULT_SLUG
    if (searchParams.get("slug") && searchParams.get("slug") !== "") {
      slug = searchParams.get("slug")
    }
    fetchLiveEventDetail(slug)
  }

  useEffect(() => {
    if (!liveEventDetail || !liveEventDetail?.guard_url) { return }
    connectVanguardWS()
    // eslint-disable-next-line
  }, [liveEventDetail])

  useEffect(() => {
    if (!vanguardChatRoom || !vanguardChatRoom?.token) { return }
    connectChatWS()
    // eslint-disable-next-line
  }, [vanguardChatRoom])

  const vanguardWS = useRef(null)
  var onConnectingVanguard = false
  function connectVanguardWS() {
    try {
      if (onConnectingVanguard) { return }
      onConnectingVanguard = true

      if (!liveEventDetail.guard_url) { return }

      vanguardWS.current = new WebSocket(liveEventDetail.guard_url)
      if (!vanguardWS.current) { return }

      vanguardWS.current.onopen = () => {
        var payload = {
          action_type: "join_chat_room",
          iat: Date.now() + (600*1000),
          recon: false,
          username: "anonymous"
        }

        try {
          vanguardWS.current.send(JSON.stringify(payload))
        } catch (error) {
          // connectVanguardWS()
        }
      }
      vanguardWS.current.onmessage = (e) => {
        e.preventDefault()
        handleVanguardWSIncomingMessage(e.data)
      }
      vanguardWS.current.onclose = (e) => { }

    } catch (error) {
      console.warn("ERROR connectVanguardWS", error)
    }
    onConnectingVanguard = false
  }

  function handleVanguardWSIncomingMessage(data) {
    try {
      var parsedData = JSON.parse(data)
      if (!parsedData) { return }
      if (parsedData.action_type === "join_chat_success") {
        console.warn("VG", parsedData)
        setVanguardChatRoom(parsedData)
        setConnState("chat data loaded")
      }
    } catch(error) {
      console.warn("ERROR handleVanguardWSIncomingMessage", error)
    }
  }

  const chatWS = useRef(null)
  function connectChatWS() {
    try {
      console.warn("HEHE", vanguardChatRoom)

      if (!vanguardChatRoom.room_id || !vanguardChatRoom.token) { return }

      var chatWSURL = "wss://gschat.goplay.co.id/chat"
      chatWS.current = new WebSocket(chatWSURL)
      if (!chatWS.current) { return }

      chatWS.current.onopen = () => {
        var payload = {
          ct: 10,
          recon: false,
          room_id: vanguardChatRoom.room_id,
          token: vanguardChatRoom.token
        }

        try {
          setConnState("connecting to chat")
          chatWS.current.send(JSON.stringify(payload))
        } catch (error) {
          // connectVanguardWS()
        }
      }
      chatWS.current.onmessage = (e) => {
        setConnState("connected to chat")
        e.preventDefault()
        handleChatWSIncomingMessage(e.data)
      }
      chatWS.current.onclose = (e) => { }

    } catch (error) {
    }

    function handleChatWSIncomingMessage(data) {
      // console.warn("INCOMING handleChatWSIncomingMessage", data)

      try {
        var parsedData = JSON.parse(data)
        if (!parsedData) { return }
        if (parsedData.ct === 20) {
          if (!appStarted) {
            return
          }

          console.warn("PARSED_CHAT", parsedData)
          setConnState("idle")
          ProcessMessage(parsedData.msg)
          allChats = [{ role: 'user', content: parsedData.msg }, ...allChats]

          setMessages(allChats)
        }
      } catch(error) {
        console.warn("ERROR handleChatWSIncomingMessage", error)
      }
    }
  }

  var vidHeight = "600px"

  return (
    <div className="container mx-auto w-full max-w-lg p-2">
      <div className='flex flex-col gap-1'>
        <div className='w-full mb-2'>
          <div className='w-full rounded-lg overflow-hidden border border-black relative h-[600px]'>
            <div className={`scale-[2.8]`}>
              <ReactPlayerCsr
                url={'/videos/ai-idle.m3u8'}
                width={"100%"}
                height={vidHeight}
                playing={playing}
                loop={true}
              />
            </div>
            <div className={`scale-[2.8] absolute top-0 transition-opacity ease-in duration-700 ${avatarState === 'talk' ? 'opacity-100' : 'opacity-0'}`}>
              <ReactPlayerCsr
                url={'/videos/ai-talk.m3u8'}
                width={"100%"}
                height={vidHeight}
                playing={playing}
                loop={true}
              />
            </div>
            <div className='absolute top-2 right-2'>
              <div className='flex gap-2'>
                {!playing && <div className='bg-white p-2 rounded-lg' onClick={()=>{
                  setPlaying(true)
                  appStarted=true
                  InitApp()
                }}>
                  Start
                </div>}
                {/* <div className='bg-white p-2 rounded-lg'>
                  {avatarState} - {connState}
                </div> */}
              </div>
            </div>
            <div className='absolute bottom-0 w-full'>
              <div className="w-full overflow-y-auto p-4 rounded-lg">
                {messages.slice(0, 2).map((message, index) => (
                  <div
                    key={index+message}
                    className={`text-black chat-message mb-2 ${
                      message.role === 'user' ? 'text-right text-blue-500' : 'text-left text-black'
                    }`}
                  >
                    <p>
                      <span className="font-bold">
                        {message.role === 'user' ? '🙂 ' : '🤖 '}
                        {message.role}
                      </span>
                    </p>
                    <div className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                      <p className='text-xs bg-white bg-opacity-70 p-2 rounded-lg max-w-xs shadow-sm max-h-28 overflow-auto'>
                        {message.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  async function ApiFetchLiveEventDetail(slug) {
    var uri = new URL(`http://${window.location.host}/api/gostream/api/v2/event_detail/${slug}`)
    if (!window.location.host.includes("localhost")) {
      uri = new URL(`https://${window.location.host}/api/gostream/api/v2/event_detail/${slug}`)
    }
    uri.search = new URLSearchParams({}).toString()
    var response = await fetch(uri, {method: "GET", headers: {"Content-Type": "application/json"}})
    return response
  }

  function iterateArrayInBatches(array, batchSize, callback) {
    for (let i = 0; i < array.length; i += batchSize) {
      const batch = array.slice(i, i + batchSize);
      callback(batch);
    }
  }

  function removeEmoticons(text) {
    // Regular expression to match most emoticons (including variations with noses, etc.)
    const emoticonRegex = /[:;8=xX]['"`^]?[-o\*\^]?[\)\]\(\[dDpP\/\\|@3<>]/g;

    // Replace matched emoticons with an empty string
    return removeEmojis(text.replace(emoticonRegex, ''));
  }

  function removeEmojis(text) {
    // Use a regular expression to match Unicode characters in the emoji range
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/gu;

    // Replace matched emojis with an empty string
    return text.replace(emojiRegex, '');
  }
}
