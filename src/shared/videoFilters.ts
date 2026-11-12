export interface VideoFilterValues {
  brightness: number;
  contrast: number;
  saturate: number;
  grayscale: number;
  sepia: number;
  hue: number;
}

export const VIDEO_FILTER_DEFAULTS: VideoFilterValues = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  grayscale: 0,
  sepia: 0,
  hue: 0,
};

export const VIDEO_FILTER_LIMITS: Record<keyof VideoFilterValues, { min: number; max: number; step: number; label: string; unit: string }> = {
  brightness: { min: 50, max: 150, step: 1, label: "Brilho", unit: "%" },
  contrast: { min: 50, max: 150, step: 1, label: "Contraste", unit: "%" },
  saturate: { min: 0, max: 200, step: 1, label: "Saturação", unit: "%" },
  hue: { min: -30, max: 30, step: 1, label: "Tom", unit: "°" },
  sepia: { min: 0, max: 100, step: 1, label: "Quente", unit: "%" },
  grayscale: { min: 0, max: 100, step: 1, label: "Preto e branco", unit: "%" },
};

export const VIDEO_FILTER_PRESETS: Array<{ id: string; label: string; values: VideoFilterValues }> = [
  { id: "normal", label: "Normal", values: { ...VIDEO_FILTER_DEFAULTS } },
  { id: "vivid", label: "Vívido", values: { brightness: 103, contrast: 112, saturate: 135, grayscale: 0, sepia: 0, hue: 0 } },
  { id: "cinema", label: "Cinema", values: { brightness: 96, contrast: 118, saturate: 90, grayscale: 0, sepia: 8, hue: 0 } },
  { id: "night", label: "Noite", values: { brightness: 88, contrast: 100, saturate: 90, grayscale: 0, sepia: 35, hue: -6 } },
  { id: "bright", label: "Clarear", values: { brightness: 122, contrast: 106, saturate: 105, grayscale: 0, sepia: 0, hue: 0 } },
  { id: "mono", label: "P&B", values: { brightness: 100, contrast: 115, saturate: 100, grayscale: 100, sepia: 0, hue: 0 } },
];

function clamp(value: unknown, key: keyof VideoFilterValues) {
  const limits = VIDEO_FILTER_LIMITS[key];
  const n = Number(value);
  if (!Number.isFinite(n)) return VIDEO_FILTER_DEFAULTS[key];
  return Math.min(limits.max, Math.max(limits.min, Math.round(n)));
}

export function normalizeVideoFilters(raw: Partial<Record<keyof VideoFilterValues, unknown>>): VideoFilterValues {
  return {
    brightness: clamp(raw.brightness, "brightness"),
    contrast: clamp(raw.contrast, "contrast"),
    saturate: clamp(raw.saturate, "saturate"),
    grayscale: clamp(raw.grayscale, "grayscale"),
    sepia: clamp(raw.sepia, "sepia"),
    hue: clamp(raw.hue, "hue"),
  };
}

export function isNeutralFilter(values: VideoFilterValues) {
  return (Object.keys(VIDEO_FILTER_DEFAULTS) as Array<keyof VideoFilterValues>)
    .every((key) => values[key] === VIDEO_FILTER_DEFAULTS[key]);
}

export function buildFilterCss(values: VideoFilterValues) {
  const parts = [
    `brightness(${values.brightness}%)`,
    `contrast(${values.contrast}%)`,
    `saturate(${values.saturate}%)`,
  ];
  if (values.hue) parts.push(`hue-rotate(${values.hue}deg)`);
  if (values.sepia) parts.push(`sepia(${values.sepia}%)`);
  if (values.grayscale) parts.push(`grayscale(${values.grayscale}%)`);
  return parts.join(" ");
}

export function findPresetId(values: VideoFilterValues) {
  return VIDEO_FILTER_PRESETS.find((preset) =>
    (Object.keys(preset.values) as Array<keyof VideoFilterValues>).every((key) => preset.values[key] === values[key]),
  )?.id || "";
}
