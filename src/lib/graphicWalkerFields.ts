import type { EnquestaMetaField } from '../types/enquesta'

/** Matches GraphicWalker's own IMutField shape (fid, name, semanticType, analyticType). */
export interface GraphicWalkerField {
  fid: string
  name: string
  semanticType: 'quantitative' | 'nominal' | 'ordinal' | 'temporal'
  analyticType: 'dimension' | 'measure'
}

/**
 * EnquestaMetaField.type ('dimension' | 'measure') IS GraphicWalker's
 * analyticType union verbatim — this is a pass-through, never a re-inference
 * from the Parquet column's dtype (EXPL-05: meta.json is the sole source of
 * truth for analytic typing).
 */
export function toGraphicWalkerFields(fields: EnquestaMetaField[]): GraphicWalkerField[] {
  return fields.map((f) => ({
    fid: f.name,
    name: f.label ?? f.name,
    analyticType: f.type,
    semanticType: f.type === 'measure' ? 'quantitative' : 'nominal',
  }))
}
