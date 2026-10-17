import { useId } from 'react'

function CandidateAvatar({ photo, className = '', alt = 'Candidate' }) {
  const rawId = useId()
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '')

  if (photo) {
    return (
      <img
        className={`avatar candidate-avatar candidate-photo ${className}`.trim()}
        src={photo}
        alt={alt}
      />
    )
  }

  return (
    <svg
      className={`avatar candidate-avatar ${className}`.trim()}
      viewBox="0 0 120 140"
      role="img"
      aria-label="Default candidate avatar"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient
          id={`avatarHair-${uid}`}
          x1="0"
          y1="0"
          x2="1"
          y2="1"
        >
          <stop offset="0" stopColor="#dce5eb" />
          <stop offset="0.38" stopColor="#60788e" />
          <stop offset="1" stopColor="#172d43" />
        </linearGradient>

        <radialGradient
          id={`avatarSkin-${uid}`}
          cx="50%"
          cy="38%"
          r="65%"
        >
          <stop offset="0" stopColor="#f7fafb" />
          <stop offset="0.68" stopColor="#d7e0e5" />
          <stop offset="1" stopColor="#9aabb7" />
        </radialGradient>

        <linearGradient
          id={`avatarClothes-${uid}`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0" stopColor="#e9eff2" />
          <stop offset="1" stopColor="#879aa8" />
        </linearGradient>
      </defs>

      <ellipse
        cx="60"
        cy="47"
        rx="30"
        ry="37"
        fill={`url(#avatarSkin-${uid})`}
        stroke="#718695"
        strokeWidth="1.2"
      />

      <path
        d="M31 48 C26 29 30 14 44 8 C57 2 75 7 84 18 C90 26 91 39 86 51 L80 40 C74 29 65 23 55 23 C45 23 37 30 32 41 Z"
        fill={`url(#avatarHair-${uid})`}
        stroke="#31495d"
        strokeWidth="1.2"
      />

      <path
        d="M33 38 C39 25 49 19 60 19 C71 19 79 25 84 36 C77 29 69 26 60 26 C50 26 41 30 33 38 Z"
        fill="#8296a5"
        opacity=".45"
      />

      <ellipse
        cx="49"
        cy="48"
        rx="2"
        ry="1.4"
        fill="#667987"
      />

      <ellipse
        cx="71"
        cy="48"
        rx="2"
        ry="1.4"
        fill="#667987"
      />

      <path
        d="M55 62 Q60 65 65 62"
        fill="none"
        stroke="#81919b"
        strokeWidth="1.1"
        strokeLinecap="round"
      />

      <path
        d="M48 78 L48 91 Q60 99 72 91 L72 78 Z"
        fill={`url(#avatarSkin-${uid})`}
        stroke="#8396a3"
        strokeWidth="1"
      />

      <path
        d="M48 87 C31 90 17 101 12 119 L8 140 L112 140 L108 119 C103 101 89 90 72 87 C69 94 65 98 60 98 C55 98 51 94 48 87 Z"
        fill={`url(#avatarClothes-${uid})`}
        stroke="#718594"
        strokeWidth="1.2"
      />

      <path
        d="M48 88 L60 101 L72 88"
        fill="#f5f8fa"
        stroke="#9aaab4"
        strokeWidth="1"
      />

      <path
        d="M60 100 L53 140 L67 140 Z"
        fill="#c5d0d7"
        opacity=".75"
      />
    </svg>
  )
}

export default CandidateAvatar