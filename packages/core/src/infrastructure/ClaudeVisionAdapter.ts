import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { IdentifiedFoodSchema, type IdentifiedFood } from '../models/nutrition'
import { SupplementInfoSchema, type SupplementInfo } from '../models/supplement'
import type { IFoodAI } from '../ports/IFoodAI'

const MODEL = 'claude-opus-4-7'

// Note on prompt caching: Opus 4.7 won't cache prefixes shorter than 4096
// tokens — the prompts below are ~400–600 tokens, so cache_control is a
// silent no-op today. If/when these grow with examples, caching activates.

const FOOD_SYSTEM_PROMPT = `You are a nutrition expert identifying food from photos.

For each food item visible in the image, return:
- name: specific and accurate. Include cooking method and form where evident.
  Good: "grilled chicken breast", "white jasmine rice", "raw spinach"
  Bad: "chicken", "rice", "salad"
- portionGrams: estimated portion weight in grams, using visual cues:
    * typical serving sizes for that food
    * plate, utensil, and hand size as scale references when present
    * apparent volume and density
- confidence: 0–1 score for your identification
    * 0.9–1.0: clearly identifiable, good lighting, common food
    * 0.7–0.9: identifiable but ambiguous portion or preparation
    * 0.5–0.7: probable but significant uncertainty
    * < 0.5: still report it, but flagged as low confidence

Ignore non-food items (utensils, plates, napkins, uncut garnish like lemon wedges).
If the image contains no recognizable food, return an empty items array.`

const SUPPLEMENT_SYSTEM_PROMPT = `You are extracting supplement product information from a product label.

Extract:
- name: product name as printed (e.g., "Magnesium Glycinate", "Vitamin D3 5000 IU")
- brand: manufacturer/brand (e.g., "Thorne", "NOW Foods"); null if not visible
- servingSize: serving size string as printed (e.g., "1 capsule", "2 tablets", "5 mL")
- ingredients: every active ingredient on the Supplement Facts panel, each with:
    * name: ingredient name including form where stated
      (e.g., "Magnesium (as Magnesium Glycinate)", "Vitamin D3 (cholecalciferol)")
    * amount: numeric amount per serving
    * unit: one of "mg" | "mcg" | "IU" | "g"

Skip inactive ingredients and "Other Ingredients" lists. If the label is unreadable
or no supplement information is visible, return name as "Unknown" with an empty
ingredients array.`

const FoodResponseSchema = z.object({
  items: z.array(IdentifiedFoodSchema),
})

const SUPPORTED_MEDIA = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
type SupportedMedia = (typeof SUPPORTED_MEDIA)[number]

export function decodeImage(base64: string): { mediaType: SupportedMedia; data: string } {
  const match = base64.match(/^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/)
  if (match) return { mediaType: match[1] as SupportedMedia, data: match[2] }
  return { mediaType: 'image/jpeg', data: base64 }
}

function makeClient(): Anthropic {
  return new Anthropic()
}

export class ClaudeVisionAdapter implements IFoodAI {
  private readonly client: Anthropic

  constructor(client?: Anthropic) {
    this.client = client ?? makeClient()
  }

  async identifyFoodsFromImage(imageBase64: string): Promise<IdentifiedFood[]> {
    const image = decodeImage(imageBase64)
    const response = await this.client.messages.parse({
      model: MODEL,
      max_tokens: 4096,
      system: [
        {
          type: 'text',
          text: FOOD_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: image.mediaType, data: image.data },
            },
            {
              type: 'text',
              text: 'Identify each food item in this photo. Estimate portion weights in grams.',
            },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(FoodResponseSchema) },
    })
    if (!response.parsed_output) {
      throw new Error(`Claude returned no parseable food identification (stop_reason=${response.stop_reason})`)
    }
    return response.parsed_output.items
  }

  async extractSupplementFromLabel(imageBase64: string): Promise<SupplementInfo> {
    const image = decodeImage(imageBase64)
    const response = await this.client.messages.parse({
      model: MODEL,
      max_tokens: 4096,
      system: [
        {
          type: 'text',
          text: SUPPLEMENT_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: image.mediaType, data: image.data },
            },
            {
              type: 'text',
              text: 'Extract the supplement information from this product label.',
            },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(SupplementInfoSchema) },
    })
    if (!response.parsed_output) {
      throw new Error(`Claude returned no parseable supplement info (stop_reason=${response.stop_reason})`)
    }
    return response.parsed_output
  }
}
