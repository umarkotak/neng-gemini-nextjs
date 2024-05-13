// pages/index.js
import React, { useEffect, useRef, useState } from 'react'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai"
import ReactPlayer from 'react-player'
const tokenizer = require('sbd')

// const MODEL_NAME = "gemini-1.5-pro-latest"
const MODEL_NAME = "gemini-1.0-pro"
const KKK = Buffer.from("QUl6YVN5QnN3WWhrQmZmZlRoMHM1dkpOTEo3enlia096OHVrbFFz", 'base64')

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

export default function Home() {
  const [userInput, setUserInput] = useState('')
  const [messages, setMessages] = useState([])
  const [avatarState, setAvatarState] = useState('idle')
  const [avatarActiveVid, setAvatarActiveVid] = useState('')
  const playerRef = useRef(null)

  const handleSubmit = async (e) => {
    e.preventDefault()

    setMessages([...messages, { role: 'user', content: userInput }])

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

    const result = await chat.sendMessage(userInput)
    const response = result.response

    setMessages([...messages, { role: 'user', content: userInput }, { role: 'gemini', content: response.text() }])

    const container = document.getElementsByClassName('chat-container')
    container.scrollTop = container.scrollHeight

    setUserInput('')

    nativeSpeak(response.text())
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
        speech.rate = 1.4
        speech.pitch = 1.5
        speech.volume = 1
        if (idx >= sentences.length-1) {
          speech.onend = () => {setAvatarState("idle")}
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

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Neng-Gemini</h1>

      <div className='flex gap-1'>
        <div className='w-full'>
          <div className='w-full rounded-lg overflow-hidden border border-black'>
            {avatarActiveVid !== '' && <ReactPlayer
              ref={playerRef}
              onReady={()=>{
              }}
              url={avatarActiveVid}
              width={"100%"}
              height={"100%"}
              playing={true}
              loop={true}
            />}
          </div>
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
