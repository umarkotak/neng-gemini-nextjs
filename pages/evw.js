// pages/index.js
import React, { useEffect, useRef, useState } from 'react'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai"
import ReactPlayer from 'react-player'
const tokenizer = require('sbd')

// const MODEL_NAME = "gemini-1.5-pro-latest"
const MODEL_NAME = "gemini-1.0-pro"
const KKK = Buffer.from("QUl6YVN5QnN3WWhrQmZmZlRoMHM1dkpOTEo3enlia096OHVrbFFz", 'base64')
const EVW_HOST = "http://api.everywhere.id"
// const SLUG = "play-everywhere-prima-napitupulu-wrx"
const SLUG = "neng-gemini"
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

export default function Evw() {
  const [userInput, setUserInput] = useState('')
  const [messages, setMessages] = useState([])
  const [avatarState, setAvatarState] = useState('idle')
  const [avatarActiveVid, setAvatarActiveVid] = useState('')
  const playerRef = useRef(null)
  const [connState, setConnState] = useState("initializing")

  const handleSubmit = async (e) => {
    e.preventDefault()

    submitMessage(userInput)

    setUserInput('')
  }

  var isGenaiAsking = false
  const submitMessage = async (textInput) => {
    // return

    if (isGenaiAsking) { return }
    isGenaiAsking = true

    try {
      console.warn("ASKING", textInput)

      setMessages([...messages, { role: 'user', content: textInput }])

      const genAI = new GoogleGenerativeAI(KKK)
      const model = genAI.getGenerativeModel({ model: MODEL_NAME })

      const chat = model.startChat({
        generationConfig,
        safetySettings,
        history: [
          {
            role: "user",
            parts: [{ text: "Bisakah kamu menjadi temanku dan membantu menjawab pertanyaan ku?" }],
          },
          {
            role: "model",
            parts: [{ text: "Tentu saja!, silakahkan bertanya." }],
          },
          {
            role: "user",
            parts: [{ text: "Jawab pertanyaanku dengan singkat saja ya, dan dalam perspektif orang pertama." }],
          },
          {
            role: "model",
            parts: [{ text: "Tentu saja, aku akan mencobanya" }],
          },
        ],
      })

      setConnState("calling gemini")
      const result = await chat.sendMessage(textInput)
      const response = result.response

      setMessages([...messages, { role: 'user', content: textInput }, { role: 'gemini', content: response.text() }])

      const container = document.getElementsByClassName('chat-container')
      container.scrollTop = container.scrollHeight

      nativeSpeak(response.text())
    } catch(e) {
      setConnState("calling gemini - fail")

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

  async function fetchLiveEventDetail() {
    const response = await ApiFetchLiveEventDetail(SLUG)
    const body = await response.json()
    console.warn(SLUG, body.data)
    setLiveEventDeail(body.data)
    setConnState("live data loaded")
  }

  useEffect(() => {
    fetchLiveEventDetail()
    // eslint-disable-next-line
  }, [])

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
        e.preventDefault()
        handleChatWSIncomingMessage(e.data)
      }
      chatWS.current.onclose = (e) => { }

    } catch (error) {
    }

    function handleChatWSIncomingMessage(data) {
      console.warn("INCOMING handleChatWSIncomingMessage", data)

      try {
        var parsedData = JSON.parse(data)
        if (!parsedData) { return }
        if (parsedData.ct === 20) {
          // console.warn("PARSED_CHAT", parsedData)
          // setChatMessages(chatMessages => [...chatMessages, parsedData])
          setConnState("idle")
          submitMessage(parsedData.msg)
          setUserInput(parsedData.msg)
          // window.scrollTo(0,document.body.scrollHeight)
        }
      } catch(error) {
        console.warn("ERROR handleChatWSIncomingMessage", error)
      }
    }
  }

  const [playerPlaying, setPlayerPlaying] = useState(false)
  return (
    <div className="container mx-auto p-4">
      <div className='flex-col gap-1'>
        <div className='w-full relative'>
          <div className='w-full rounded-lg overflow-hidden border border-black'>
            {avatarActiveVid !== '' && <ReactPlayer
              ref={playerRef}
              onReady={()=>{
              }}
              url={avatarActiveVid}
              width={"100%"}
              height={"100%"}
              playing={playerPlaying}
              loop={true}
            />}
          </div>
          <button
            className='absolute left-10 top-10 rounded bg-red-500 bg-opacity-100 px-4 py-2'
            onClick={()=>setPlayerPlaying(!playerPlaying)}
          >
            <span className='text-white text-center'>{connState}</span>
          </button>
          <button
            className='absolute left-[300px] top-10 rounded bg-red-500 bg-opacity-100 px-4 py-2'
            onClick={()=>setPlayerPlaying(!playerPlaying)}
          >
            <span className='text-white text-center'>{userInput}</span>
          </button>
        </div>

        <div className='w-full max-w-xs'>
          <div id="chatbox" className="chat-container h-96 overflow-y-auto p-4 bg-gray-100 rounded-lg">
            {messages.map((message, index) => (
              <div
                key={index+message}
                className={`text-black chat-message mb-2 ${
                  message.role === 'user' ? 'text-right text-blue-500' : 'text-left text-black'
                }`}
              >
                <p>
                  <span className="font-bold">{message.role}</span>
                </p>
                <p className='text-xs'>
                  {message.content}
                </p>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex mt-4">
            <input
              type="text"
              className="flex-grow border border-gray-300 rounded-l-md p-2 focus:outline-none"
              placeholder="Type your message..."
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
            />
            <button
              type="submit"
              className="bg-blue-500 text-white rounded-r-md px-4 py-2 hover:bg-blue-600"
            >
              Send
            </button>
          </form>

          <div className='flex flex-col gap-1 mt-2 text-black'>
            {voices.map((v, idx)=>(
              v.lang !== "id-ID" ? null :
              <div className='bg-white rounded-lg p-1' key={v.lang+v.name}>
                {idx}: {v.lang} - {v.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  async function ApiFetchLiveEventDetail(slug) {
    var uri = new URL(`http://${window.location.host}/api/gostream/api/v2/event_detail/${slug}`)
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
