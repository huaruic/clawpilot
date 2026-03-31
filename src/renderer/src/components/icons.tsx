import React from 'react'

type IconProps = {
  className?: string
}

function BaseIcon({
  children,
  className,
}: IconProps & { children: React.ReactNode }): React.ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? 'h-4 w-4'}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function IconStatus(props: IconProps): React.ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M4 14c3-6 6-6 8 0s5 6 8 0" />
      <path d="M4 14v6h16v-6" />
      <path d="M4 8h16" />
    </BaseIcon>
  )
}

export function IconChat(props: IconProps): React.ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M6 18l-2 2v-2" />
      <path d="M4 18V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H4z" />
      <path d="M8 9h8" />
      <path d="M8 12h6" />
    </BaseIcon>
  )
}

export function IconChannels(props: IconProps): React.ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M4 7h16v10H4z" />
      <path d="M4 7l8 6 8-6" />
    </BaseIcon>
  )
}

export function IconKey(props: IconProps): React.ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M7.5 15.5a4.5 4.5 0 1 1 3.7-7.1" />
      <path d="M11 12h10" />
      <path d="M17 12v3" />
      <path d="M20 12v2" />
    </BaseIcon>
  )
}

export function IconBolt(props: IconProps): React.ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M13 2L3 14h7l-1 8 12-14h-7z" />
    </BaseIcon>
  )
}

export function IconMemory(props: IconProps): React.ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M8 6h8" />
      <path d="M8 10h8" />
      <path d="M8 14h8" />
      <path d="M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z" />
    </BaseIcon>
  )
}

export function IconList(props: IconProps): React.ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </BaseIcon>
  )
}

export function IconPulse(props: IconProps): React.ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M4 13h3l2-6 4 12 2-6h5" />
    </BaseIcon>
  )
}

export function IconSettings(props: IconProps): React.ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
      <path d="M19.4 15a7.9 7.9 0 0 0 .1-2l2-1.2-2-3.5-2.2.8a7.9 7.9 0 0 0-1.7-1l-.3-2.3H10l-.3 2.3a7.9 7.9 0 0 0-1.7 1L5.8 8.3l-2 3.5 2 1.2a7.9 7.9 0 0 0 .1 2l-2 1.2 2 3.5 2.2-.8a7.9 7.9 0 0 0 1.7 1l.3 2.3h4.4l.3-2.3a7.9 7.9 0 0 0 1.7-1l2.2.8 2-3.5z" />
    </BaseIcon>
  )
}

