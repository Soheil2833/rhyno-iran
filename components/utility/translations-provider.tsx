"use client"

import { useRef } from "react"
import initTranslations from "@/lib/i18n"
import { createInstance, i18n as I18nInstance } from "i18next"
import { I18nextProvider } from "react-i18next"

export default function TranslationsProvider({
  children,
  locale,
  namespaces,
  resources
}: any) {
  const i18nRef = useRef<I18nInstance | null>(null)

  // اگر اینستنس وجود ندارد، آن را بساز (فقط بار اول)
  if (!i18nRef.current) {
    i18nRef.current = createInstance()
    initTranslations(locale, namespaces, i18nRef.current, resources)
  }

  return <I18nextProvider i18n={i18nRef.current}>{children}</I18nextProvider>
}
