import { onRequestOptions as __api_chat_js_onRequestOptions } from "/Users/lawrencenadjafian/Downloads/oryele_v182-7-8/functions/api/chat.js"
import { onRequestPost as __api_chat_js_onRequestPost } from "/Users/lawrencenadjafian/Downloads/oryele_v182-7-8/functions/api/chat.js"
import { onRequestOptions as __api_contact_js_onRequestOptions } from "/Users/lawrencenadjafian/Downloads/oryele_v182-7-8/functions/api/contact.js"
import { onRequestPost as __api_contact_js_onRequestPost } from "/Users/lawrencenadjafian/Downloads/oryele_v182-7-8/functions/api/contact.js"
import { onRequestOptions as __api_subscribe_js_onRequestOptions } from "/Users/lawrencenadjafian/Downloads/oryele_v182-7-8/functions/api/subscribe.js"
import { onRequestPost as __api_subscribe_js_onRequestPost } from "/Users/lawrencenadjafian/Downloads/oryele_v182-7-8/functions/api/subscribe.js"

export const routes = [
    {
      routePath: "/api/chat",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_chat_js_onRequestOptions],
    },
  {
      routePath: "/api/chat",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_chat_js_onRequestPost],
    },
  {
      routePath: "/api/contact",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_contact_js_onRequestOptions],
    },
  {
      routePath: "/api/contact",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_contact_js_onRequestPost],
    },
  {
      routePath: "/api/subscribe",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_subscribe_js_onRequestOptions],
    },
  {
      routePath: "/api/subscribe",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_subscribe_js_onRequestPost],
    },
  ]