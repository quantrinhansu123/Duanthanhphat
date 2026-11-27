import { checkTb15Ground, type GroundCheckInput, type IrregularInput, type IrregularWave } from "./tb15-ground";

export type GroundCheckResult = ReturnType<typeof checkTb15Ground>;

/** Một mảnh trong vế «thay số». Có source thì người dùng đưa chuột vào để xem nguồn. */
export type FormulaPiece = { text: string; source?: string };

/** Dạng T = X + Y = 10 + 10 = 20. note là một câu nói phép đó làm gì và đơn vị. */
export type FormulaLine = { symbols: string; values: FormulaPiece[]; result: string; note?: string };

export type Step10Origin = {
  climate?: string;
  rail?: string;
  steel?: string;
  track?: string;
  seat?: string;
  scheme?: string;
  factor?: string;
  ballast?: string;
  fastener?: string;
  /** Dòng hệ số vận tốc A.0.2-1 đã tra. */
  speed?: string;
};

export type WorkedItem = {
  id: string;
  label: string;
  display: string;
  /** Chưa có phép tính trên nút này. Chữ kết quả hiện màu đỏ. */
  unavailable?: boolean;
  formula?: string;
  steps?: FormulaLine[];
  lines?: string[];
  conclusion?: string;
};

export type Step10Sheet = {
  id: string;
  title: string;
  scope: string;
  items: WorkedItem[];
  table?: {
    caption: string;
    headers: string[];
    rows: string[][];
    details?: FormulaLine[][];
    /** Pn = Y·η và Pμ = Y·μ của từng trục lấy lực, song song với từng dòng mặt cắt. */
    forces?: { axle: string; pn: string; pmu: string; sumPn: string; sumPmu: string }[][];
  };
};

function num(value: number, digits = 4) {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs !== 0 && abs < 5 * 10 ** -(digits + 1)) {
    return value.toLocaleString("vi-VN", { maximumSignificantDigits: 4 });
  }
  return value.toLocaleString("vi-VN", { maximumFractionDigits: digits });
}

function item(partial: WorkedItem): WorkedItem {
  return partial;
}

function piece(text: string, source?: string): FormulaPiece {
  return source ? { text, source } : { text };
}

function equation(symbols: string, values: FormulaPiece[], result: string, note?: string): FormulaLine {
  return note ? { symbols, values, result, note } : { symbols, values, result };
}

function origins(origin?: Step10Origin) {
  return {
    rail: origin?.rail ? `Mặt cắt ray «${origin.rail}»` : "Mặt cắt ray đã chọn",
    steel: origin?.steel ? `Danh mục mác thép «${origin.steel}», cột [σ]` : "Danh mục mác thép, cột [σ]",
    track: origin?.track ? `Kết cấu đường «${origin.track}»` : "Kết cấu đường đã chọn",
    seat: origin?.seat ? `Độ cứng gối «${origin.seat}»` : "Độ cứng gối đã chọn",
    climate: origin?.climate ? `Trạm khí hậu «${origin.climate}»` : "Trạm khí hậu đã chọn",
    scheme: origin?.scheme ? `Sơ đồ tải «${origin.scheme}»` : "Sơ đồ tải một ray đã chọn",
    factor: origin?.factor ? `Hệ số lực ngang «${origin.factor}»` : "Hệ số lực ngang đã chọn",
    ballast: origin?.ballast ? `Bảng B.0.4-1, ${origin.ballast}` : "Bảng B.0.4-1 theo loại tà vẹt",
    fastener: origin?.fastener ? `Phụ kiện «${origin.fastener}»` : "Mô men cản phụ kiện B.0.4-2",
    speed: origin?.speed ? `Hệ số vận tốc «${origin.speed}»` : "Bảng hệ số vận tốc A.0.2-1",
  };
}

function sectionLines(
  section: GroundCheckResult["sections"][number],
  k: number,
  foundation: number,
  spacingMm: number,
  scheme: string,
): FormulaLine[] {
  const lines = section.terms.flatMap((term) => {
    const same = term.position === section.position;
    return [
      equation(`khoảng cách, trục lấy lực x = ${num(term.position)} m`, [
        piece(`|${num(term.position)} − ${num(section.position)}|`, same ? "Chính trục đang đặt mặt cắt" : `${scheme}: x trục lấy lực và x mặt cắt`),
      ], `${num(term.distanceMm / 1000)} m = ${num(term.distanceMm, 1)} mm`, "Khoảng cách dọc ray giữa trục lấy lực và trục đặt mặt cắt."),
      equation("z = k · khoảng cách", [
        piece(num(k, 8), "k của nền, 1/mm"),
        piece(" · "),
        piece(num(term.distanceMm, 1), "khoảng cách vừa tính, mm"),
      ], num(term.z, 6), "Đổi khoảng cách ra số không thứ nguyên z."),
      equation("η = exp(−z) · (cos z + sin z)", [
        piece(`exp(−${num(term.z, 6)}) · (cos ${num(term.z, 6)} + sin ${num(term.z, 6)})`, "z vừa tính"),
      ], num(term.eta, 6), "Hệ số lún η của trục lấy lực này."),
      equation("μ = exp(−z) · (cos z − sin z)", [
        piece(`exp(−${num(term.z, 6)}) · (cos ${num(term.z, 6)} − sin ${num(term.z, 6)})`, "z vừa tính"),
      ], num(term.mu, 6), "Hệ số mô men μ của trục lấy lực này."),
      equation("Pn = Y · η", [
        piece(num(term.load * 1000, 1), `${scheme}: Y = ${num(term.load)} kN, đổi sang N`),
        piece(" · "),
        piece(num(term.eta, 6), "η vừa tính"),
      ], `${num(term.settlementTerm, 4)} N`, "Pn của trục lấy lực này, N. Cột Pn trong bảng mở ra."),
      equation("Pμ = Y · μ", [
        piece(num(term.load * 1000, 1), `${scheme}: Y đổi sang N`),
        piece(" · "),
        piece(num(term.mu, 6), "μ vừa tính"),
      ], `${num(term.momentTerm, 4)} N`, "Pμ của trục lấy lực này, N. Cột Pμ trong bảng mở ra."),
    ];
  });
  const seatNewton = k * spacingMm * section.settlementSum / 2;
  lines.push(
    equation("Σ Pn", [
      piece(section.terms.map((term) => num(term.settlementTerm, 4)).join(" + "), "Cộng Pn của mọi trục lấy lực, kể cả chính mặt cắt"),
    ], `${num(section.settlementSum, 4)} N`, "Tổng cột Pn. Độ lún và phản lực gối lấy tổng này."),
    equation("Σ Pμ", [
      piece(section.terms.map((term) => num(term.momentTerm, 4)).join(" + "), "Cộng Pμ của mọi trục lấy lực, kể cả chính mặt cắt"),
    ], `${num(section.momentSum, 4)} N`, "Tổng cột Pμ. Mô men tĩnh lấy tổng này."),
    equation("độ lún = k · tổng lún / (2u)", [
      piece(num(k, 8), "k, 1/mm"),
      piece(" · "),
      piece(num(section.settlementSum, 1), "tổng lún, N"),
      piece(" / (2 · "),
      piece(num(foundation), "u = D / a, N/mm²"),
      piece(")"),
    ], `${num(section.settlement)} mm`, "Độ lún tại mặt cắt này, mm. Khớp cột Độ lún."),
    equation("mô men = tổng mô men / (4k)", [
      piece(num(section.momentSum, 1), "tổng mô men, N"),
      piece(" / (4 · "),
      piece(num(k, 8), "k, 1/mm"),
      piece(")"),
    ], `${num(section.moment, 1)} N·mm = ${num(section.moment / 1e6)} kN·m`, "Mô men tĩnh tại mặt cắt này. Cột M tĩnh dùng kN·m."),
    equation("lực gối = k · a · tổng lún / 2", [
      piece(num(k, 8), "k, 1/mm"),
      piece(" · "),
      piece(num(spacingMm, 1), "cự ly nút a, mm"),
      piece(" · "),
      piece(num(section.settlementSum, 1), "tổng lún, N"),
      piece(" / 2"),
    ], `${num(seatNewton, 1)} N = ${num(section.seatLoad)} kN`, "Phản lực gối, đổi N sang kN. Khớp cột Phản lực gối."),
  );
  return lines;
}

function waveLines(wave: IrregularWave, irregular: IrregularInput, rail: string, ballast: string, fastener: string): FormulaLine[] {
  const scan = "Pmin là P nhỏ nhất khi l chạy từ 100 đến 1.500 cm, bước 5 cm. Chỉ viết bước sóng thắng.";
  const shorter = wave.l < wave.l0;
  const equal = wave.l === wave.l0;
  const phi = equal
    ? equation("φ = 1", [piece("1", `l = l₀ = ${num(wave.l, 1)} cm`)], "1", scan)
    : equation(
      shorter ? "φ = 2 · l₀ · l / (π · (l₀² − l²)) · sin(π · l / l₀)" : "φ = 2 · l₀² / (π · (l² − l₀²)) · sin(π · l₀ / l)",
      [
        piece(num(wave.l0, 1), `${rail}: l₀, cm`),
        piece(" , l = "),
        piece(num(wave.l, 1), "bước sóng thắng, cm"),
      ],
      num(wave.phi, 6),
      scan,
    );
  const eta = equal
    ? equation("η = 1", [piece("1", "l = l₀")], "1", "Hệ số η khi bước sóng bằng l₀.")
    : equation(
      shorter ? "η = φ · l₀ / l" : "η = φ · l / l₀",
      [
        piece(num(wave.phi, 6), "φ vừa tính"),
        piece(" · "),
        piece(num(shorter ? wave.l0 : wave.l, 1), shorter ? "l₀, cm" : "l thắng, cm"),
        piece(" / "),
        piece(num(shorter ? wave.l : wave.l0, 1), shorter ? "l thắng, cm" : "l₀, cm"),
      ],
      num(wave.eta, 6),
      "Hệ số η tại bước sóng thắng.",
    );
  return [
    phi,
    eta,
    equation("f / l² + d · i₀ / l₀ · φ", [
      piece(num(wave.f, 2), "f = 0,02 cm, hằng số B.0.4"),
      piece(" / "),
      piece(`${num(wave.l, 1)}²`, "l thắng, cm"),
      piece(" + "),
      piece(num(wave.d, 4), "d = 0,5833, hằng số B.0.4"),
      piece(" · "),
      piece(num(wave.i0, 6), `${rail}: i₀ đổi từ ‰`),
      piece(" / "),
      piece(num(wave.l0, 1), "l₀, cm"),
      piece(" · "),
      piece(num(wave.phi, 6), "φ"),
    ], num(wave.bend, 8), "Số hạng uốn trong τI, cm⁻¹."),
    equation("τI = 8 · E · Iy · π² · (f / l² + d · i₀ / l₀ · φ)", [
      piece("8 · "),
      piece(num(wave.modulusCm, 1), "E đổi sang N/cm²"),
      piece(" · "),
      piece(num(wave.inertiaCm), "Iy đổi sang cm⁴"),
      piece(" · π² · "),
      piece(num(wave.bend, 8), "số hạng uốn vừa tính"),
    ], `${num(wave.tauI, 1)} N`, "Thành phần độ cứng chống uốn τI, N."),
    equation("q₀ − 2 · B · G · f^Z + 2 · C · K · f^(1/N)", [
      piece(num(irregular.q0), `${ballast}: q₀, N/cm`),
      piece(" − 2 · "),
      piece(num(irregular.B), `${ballast}: B`),
      piece(" · "),
      piece(num(wave.G, 6), "G tính từ Z"),
      piece(" · "),
      piece(`${num(wave.f, 2)}^${num(irregular.Z)}`, `${ballast}: Z`),
      piece(" + 2 · "),
      piece(num(irregular.C), `${ballast}: C`),
      piece(" · "),
      piece(num(wave.K, 6), "K tính từ N"),
      piece(" · "),
      piece(`${num(wave.f, 2)}^(1/${num(irregular.N)})`, `${ballast}: N`),
    ], num(wave.ballastPiece, 6), "Thành phần nền trong τQM, N/cm."),
    equation("(2 · ψ · H) / π² · f^(1/μ) · l^((μ − 1) / μ)", [
      piece("2 · "),
      piece(num(wave.psi, 6), "ψ tính từ μ"),
      piece(" · "),
      piece(num(irregular.H), `${fastener}: H, N·cm/cm`),
      piece(" / π² · "),
      piece(`${num(wave.f, 2)}^(1/${num(irregular.mu)})`, `${fastener}: μ`),
      piece(" · "),
      piece(`${num(wave.l, 1)}^((μ − 1) / μ)`, "l thắng, cm"),
    ], num(wave.fastenerPiece, 6), "Thành phần phụ kiện trong τQM, N."),
    equation("τQM = (l² / π²) · thành phần nền + thành phần phụ kiện", [
      piece(`${num(wave.l, 1)}² / π² · `),
      piece(num(wave.ballastPiece, 6), "thành phần nền vừa tính"),
      piece(" + "),
      piece(num(wave.fastenerPiece, 6), "thành phần phụ kiện vừa tính"),
    ], `${num(wave.tauQm, 1)} N`, "Lực cản nền và phụ kiện τQM, N."),
    equation("mẫu số = f + l · i₀ · η + độ cong", [
      piece(num(wave.f, 2), "f, cm"),
      piece(" + "),
      piece(num(wave.l, 1), "l, cm"),
      piece(" · "),
      piece(num(wave.i0, 6), "i₀"),
      piece(" · "),
      piece(num(wave.eta, 6), "η"),
      piece(" + "),
      piece(num(wave.curve, 6), "độ cong tuyến tại l này, cm. Đường thẳng thì bằng 0"),
    ], num(wave.denominator, 6), "Mẫu số của lực nén P, cm."),
    equation("P = (τI + τQM) / mẫu số", [
      piece(num(wave.tauI, 1), "τI, N"),
      piece(" + "),
      piece(num(wave.tauQm, 1), "τQM, N"),
      piece(") / "),
      piece(num(wave.denominator, 6), "mẫu số vừa tính"),
    ], `${num(wave.pressure, 1)} N`, "P tại bước sóng thắng. Đây là Pmin của phép quét."),
  ];
}

function uniformChain(input: GroundCheckInput) {
  const f = 0.2;
  const plastic = 0.83;
  const elastic = 0.17;
  const initialCurvature = 2.103e-6;
  const t = elastic * initialCurvature;
  const lineCurvature = input.radius === 0 ? 0 : 1 / (100 * input.radius);
  const curvature = lineCurvature + 8 * plastic * initialCurvature;
  const modulusCm = input.steelModulus * 100;
  const inertiaCm = input.iy / 1e4;
  const rigidity = 2 * modulusCm * inertiaCm * Math.PI ** 2;
  const curvatureTerm = 4 * curvature / Math.PI ** 3;
  const omega = rigidity * (t + curvatureTerm);
  const ballast = input.lateralResistance * 10;
  const ballastTerm = 4 * ballast / Math.PI ** 3;
  const denominator = ballastTerm - omega * t / f;
  const halfWaveSquared = (omega + Math.sqrt(omega ** 2 + denominator * f * rigidity)) / denominator;
  const foe = t * halfWaveSquared;
  const critical = (rigidity * (f + foe) / halfWaveSquared + ballastTerm * halfWaveSquared)
    / (f + foe + curvatureTerm * halfWaveSquared);
  const allowed = critical / input.safety;
  const areaCm = input.area / 100;
  const radical = omega ** 2 + denominator * f * rigidity;
  return {
    f, plastic, elastic, initialCurvature, t, lineCurvature, curvature,
    modulusCm, inertiaCm, rigidity, curvatureTerm, omega, ballast, ballastTerm,
    denominator, radical, halfWaveSquared, foe, critical, allowed, areaCm,
  };
}

function riseAtTrial(input: GroundCheckInput, result: GroundCheckResult) {
  if (result.rise !== null) return result.rise;
  return Math.max(0, input.maxRailTemperature - result.candidate + input.lockTolerance);
}

/** ΔTd,max = Te + biên độ − Tmin. Te ngoài khoảng vẫn lấy tâm khóa tính thử, giống ΔTu. */
function dropAtTrial(input: GroundCheckInput, result: GroundCheckResult) {
  if (result.drop !== null) return result.drop;
  return result.candidate + input.lockTolerance - input.minRailTemperature;
}

export function buildTb15Step10(input: GroundCheckInput, result: GroundCheckResult, origin?: Step10Origin): Step10Sheet[] {
  const te = result.lockTemperature ?? result.candidate;
  const inside = result.lockTemperature !== null;
  const riseActual = riseAtTrial(input, result);
  const dropActual = dropAtTrial(input, result);
  const thermalStress = input.steelModulus * input.expansion * dropActual;
  const totalStress = result.baseStress + thermalStress + input.additionalStress + input.brakingStress;
  const gapActual = result.gap ?? input.steelModulus * input.area * (input.expansion * dropActual) ** 2 / input.resistance;
  const compression = 2 * input.steelModulus * input.area * input.expansion * riseActual;
  const useRatio = riseActual / result.riseLimit;
  const forceRatio = compression / result.allowedForce;
  const chain = uniformChain(input);
  const from = origins(origin);
  const methodLabel = result.riseMethod === "uniform"
    ? "B.0.3 — bước sóng đều"
    : result.riseMethod === "irregular"
      ? "B.0.4 — bước sóng không đều"
      : "số nhỏ hơn giữa B.0.3 và B.0.4";
  const governing = result.sections.reduce((best, section) => section.moment > best.moment ? section : best);
  const bendingSum = governing.momentSum;
  const seatD = input.seatStiffness * 1000;
  const spacingMm = input.spacing * 1000;
  const passedStrength = totalStress <= result.stressLimit;
  const passedGap = gapActual <= input.gapLimit;
  const passedRise = riseActual <= result.riseLimit;
  const coldLimit = Math.min(result.dropStrength, result.dropGap);

  const moment: WorkedItem = item({
    id: "m0",
    label: "Mô men tĩnh lớn nhất M₀",
    display: `${num(result.staticMoment / 1e6)} kN·m tại x = ${num(governing.position)} m`,
    steps: [
      equation("u = D / a", [
        piece(num(seatD, 1), `${from.seat}: D, đổi từ kN/mm sang N/mm`),
        piece(" / "),
        piece(num(spacingMm, 1), `${from.track}: cự ly nút a, đổi từ m sang mm`),
      ], `${num(result.foundation)} N/mm²`),
      equation("4 · E · Ix", [
        piece("4 · "),
        piece(num(input.steelModulus, 1), `${from.rail}: mô đun đàn hồi E, N/mm²`),
        piece(" · "),
        piece(num(input.ix, 1), `${from.rail}: mô men quán tính Ix, mm⁴`),
      ], `${num(4 * input.steelModulus * input.ix, 1)} N·mm²`, "Nhân 4, E và Ix. Đơn vị N·mm²."),
      equation("u / (4 · E · Ix)", [
        piece(num(result.foundation), "u vừa tính, N/mm²"),
        piece(" / "),
        piece(num(4 * input.steelModulus * input.ix, 1), "tích 4·E·Ix vừa tính"),
      ], `${num(result.foundation / (4 * input.steelModulus * input.ix), 8)} 1/mm⁴`, "Chia u cho tích vừa có. Đơn vị 1/mm⁴."),
      equation("k = [u / (4 · E · Ix)]^(1/4)", [
        piece(num(result.foundation / (4 * input.steelModulus * input.ix), 8), "thương vừa tính"),
      ], `${num(result.k, 8)} 1/mm = ${num(result.k * 1000)} 1/m`, "Lấy căn bậc bốn. Các bước mô men dùng k theo 1/mm."),
      equation("M₀ = Σ(Y · μ) / (4k)", [
        piece(num(bendingSum, 1), `Tổng Y·μ tại mặt cắt x = ${num(governing.position)} m. Bấm dòng đó trong bảng nội lực để xem từng trục`),
        piece(" / (4 · "),
        piece(num(result.k, 8), "k vừa tính, 1/mm"),
        piece(")"),
      ], `${num(result.staticMoment / 1e6)} kN·m`, "M₀ là mô men lớn nhất trong các mặt cắt. Đơn vị đổi từ N·mm sang kN·m."),
    ],
  });

  const dynamicMoment: WorkedItem = item({
    id: "md",
    label: "Mô men uốn động Md",
    display: `${num(result.dynamicMoment / 1e6)} kN·m`,
    steps: [
      input.speed > (input.speedCapKmh ?? 160)
        ? equation("α = hệ số vận tốc", [
          piece(num(input.highSpeedFactor ?? 1, 4), `${from.speed}. v = ${num(input.speed, 1)} km/h vượt ngưỡng ${num(input.speedCapKmh ?? 160, 2)} km/h`),
        ], num(input.highSpeedFactor ?? 1, 4))
        : equation("α = hệ số sức kéo · v / 100", [
          piece(num(input.speedCoefficient, 4), `${from.speed}: hệ số theo loại sức kéo`),
          piece(" · "),
          piece(num(input.speed, 1), "Ô Tốc độ thiết kế (km/h)"),
          piece(" / 100"),
        ], num(result.alphaSpeed)),
      result.betaStandard
        ? equation("β = 0,002 · |Δh|", [
          piece("0,002", "Cặp chuẩn H = 2.300 mm và S = 1.500 mm, dùng hệ số 0,002 của bảng tính"),
          piece(" · "),
          piece(num(Math.abs(input.cantDeficiency)), "Ô Siêu cao thiếu hoặc thừa Δh (mm)"),
        ], num(result.betaLoad))
        : equation("β = 2 · |Δh| · H / S²", [
          piece(num(Math.abs(input.cantDeficiency)), "Ô Siêu cao thiếu hoặc thừa Δh (mm)"),
          piece(" · "),
          piece(num(input.cgHeightMm ?? 0, 1), "Chiều cao trọng tâm H trên bảng khổ ray"),
          piece(" / "),
          piece(`${num(input.railCenterMm ?? 0, 1)}²`, "Khoảng cách tim hai ray S trên bảng khổ ray"),
        ], num(result.betaLoad)),
      equation("Md = M₀ · (1 + α + β)", [
        piece(num(result.staticMoment / 1e6), "M₀, mô men tĩnh lớn nhất vừa tính"),
        piece(" · (1 + "),
        piece(num(result.alphaSpeed), "α vừa tính từ tốc độ và loại sức kéo"),
        piece(" + "),
        piece(num(result.betaLoad), "β vừa tính từ siêu cao"),
        piece(")"),
      ], `${num(result.dynamicMoment / 1e6)} kN·m`),
    ],
  });

  const baseStress: WorkedItem = item({
    id: "base",
    label: "Ứng suất động đáy ray",
    display: `${num(result.baseStress)} MPa`,
    steps: [
      equation("σđế = f · Md / Wđế", [
        piece(num(input.lateralFactor), `${from.factor}: hệ số lực ngang f`),
        piece(" · "),
        piece(num(result.dynamicMoment, 1), "Md vừa tính, đổi ra N·mm"),
        piece(" / "),
        piece(num(input.baseModulus, 1), `${from.rail}: mô đun chống uốn đáy Wđế, mm³`),
      ], `${num(result.baseStress)} MPa`),
    ],
  });

  const allowable: WorkedItem = item({
    id: "allowable",
    label: "Ứng suất cho phép [σ]",
    display: `${num(result.stressLimit, 2)} MPa`,
    steps: [
      equation("[σ] của mác thép", [
        piece(num(result.stressLimit, 2), from.steel),
      ], `${num(result.stressLimit, 2)} MPa`),
    ],
  });

  const dropStrength: WorkedItem = item({
    id: "drop-strength",
    label: "Biên độ giảm nhiệt cho phép theo cường độ [ΔTd]",
    display: `${num(result.dropStrength)} °C`,
    steps: [
      equation("[ΔTd] = ([σ] − σđế − σf − σz) / (E · α)", [
        piece("("),
        piece(num(result.stressLimit, 2), "[σ] lấy từ mác thép đã chọn"),
        piece(" − "),
        piece(num(result.baseStress), "σđế vừa tính từ f·Md / Wđế"),
        piece(" − "),
        piece(num(input.additionalStress), "Ô Ứng suất kéo phụ σf trên form"),
        piece(" − "),
        piece(num(input.brakingStress), "Ô Ứng suất kéo/hãm σz trên form"),
        piece(") / ("),
        piece(num(input.steelModulus, 1), `${from.rail}: mô đun đàn hồi E`),
        piece(" · "),
        piece(num(input.expansion, 8), `${from.rail}: hệ số giãn nở α`),
        piece(")"),
      ], `${num(result.dropStrength)} °C`),
    ],
  });

  const strengthCheck: WorkedItem = item({
    id: "strength-check",
    label: "Kiểm cường độ ray",
    display: `${passedStrength ? "ĐẠT" : "KHÔNG ĐẠT"} — ${num(totalStress)} MPa so với ${num(result.stressLimit)} MPa`,
    steps: [
      equation("Tu = Te + biên độ", [
        piece(num(te), inside ? "Nhiệt độ khóa Te vừa tính, nằm trong khoảng" : "Tâm khóa tính thử, đang nằm ngoài khoảng khóa"),
        piece(" + "),
        piece(num(input.lockTolerance), "Ô Biên độ khóa"),
      ], `${num(te + input.lockTolerance)} °C`),
      equation("ΔTd,max = Tu − Tmin", [
        piece(num(te + input.lockTolerance), "Tu vừa tính"),
        piece(" − "),
        piece(num(input.minRailTemperature), `${from.climate}: Tmin ray bằng Tmin không khí của tháng đã chọn`),
      ], `${num(dropActual)} °C`),
      equation("σt = E · α · ΔTd,max", [
        piece(num(input.steelModulus, 1), `${from.rail}: mô đun đàn hồi E`),
        piece(" · "),
        piece(num(input.expansion, 8), `${from.rail}: hệ số giãn nở α`),
        piece(" · "),
        piece(num(dropActual), "ΔTd,max vừa tính"),
      ], `${num(thermalStress)} MPa`),
      equation("Tổng = σđế + σt + σf + σz", [
        piece(num(result.baseStress), "σđế vừa tính"),
        piece(" + "),
        piece(num(thermalStress), "σt vừa tính"),
        piece(" + "),
        piece(num(input.additionalStress), "Ô Ứng suất kéo phụ σf"),
        piece(" + "),
        piece(num(input.brakingStress), "Ô Ứng suất kéo/hãm σz"),
      ], `${passedStrength ? "ĐẠT" : "KHÔNG ĐẠT"} — ${num(totalStress)} MPa so với [σ] = ${num(result.stressLimit)} MPa`),
    ],
    lines: inside ? undefined : ["Tâm khóa tính thử nằm ngoài khoảng khóa. Ứng suất nhiệt vẫn tính theo tâm khóa đó."],
  });

  const uniformRise: WorkedItem = item({
    id: "rise-b03",
    label: "[ΔTu] theo B.0.3",
    display: `${num(result.riseUniform)} °C`,
    steps: [
      equation("E (N/cm²) = E (MPa) · 100", [
        piece(num(input.steelModulus, 1), `${from.rail}: E, N/mm²`),
        piece(" · 100"),
      ], `${num(chain.modulusCm, 1)} N/cm²`, "Đổi E sang N/cm² để vào công thức B.0.3."),
      equation("Iy (cm⁴) = Iy (mm⁴) / 10⁴", [
        piece(num(input.iy, 1), `${from.rail}: Iy, mm⁴`),
        piece(" / 10.000"),
      ], `${num(chain.inertiaCm)} cm⁴`, "Đổi mô men quán tính ngang sang cm⁴."),
      equation("Q (N/cm) = q · 10", [
        piece(num(input.lateralResistance), `${from.track}: sức cản ngang q`),
        piece(" · 10"),
      ], `${num(chain.ballast)} N/cm`, "Đổi sức cản ngang sang N/cm."),
      equation("f = 0,2", [
        piece("0,2", "Hằng số B.0.3, không lấy từ form"),
      ], "0,2 cm", "Độ võng ban đầu f, cm."),
      equation("t = 0,17 × 2,103×10⁻⁶", [
        piece("0,17", "Tỷ lệ biến dạng đàn hồi, hằng số B.0.3"),
        piece(" × "),
        piece("2,103×10⁻⁶", "Độ cong ban đầu, hằng số B.0.3"),
      ], num(chain.t, 12), "Độ lệch đàn hồi ban đầu t, cm⁻¹."),
      equation(input.radius === 0 ? "độ cong đường = 0" : "độ cong đường = 1 / (100 · R)", [
        piece(input.radius === 0 ? "0" : num(input.radius, 1), input.radius === 0 ? "Đường thẳng, R = 0" : "Ô bán kính cong R, m"),
      ], num(chain.lineCurvature, 12), "Độ cong của tuyến, cm⁻¹. Đường thẳng thì bằng 0."),
      equation("độ cong = độ cong đường + 8 × 0,83 × 2,103×10⁻⁶", [
        piece(num(chain.lineCurvature, 12), "độ cong đường vừa tính"),
        piece(" + 8 × 0,83 × 2,103×10⁻⁶"),
      ], num(chain.curvature, 12), "Cộng độ cong dẻo ban đầu. Đơn vị cm⁻¹."),
      equation("độ cứng = 2 · E · Iy · π²", [
        piece("2 · "),
        piece(num(chain.modulusCm, 1), "E vừa đổi, N/cm²"),
        piece(" · "),
        piece(num(chain.inertiaCm), "Iy vừa đổi, cm⁴"),
        piece(" · π²"),
      ], `${num(chain.rigidity, 1)} N·cm²`, "Độ cứng chống uốn của hai ray."),
      equation("số hạng cong = 4 · độ cong / π³", [
        piece("4 · "),
        piece(num(chain.curvature, 12), "độ cong vừa tính"),
        piece(" / π³"),
      ], num(chain.curvatureTerm, 12), "Đưa độ cong về số hạng trong công thức lực tới hạn."),
      equation("ω = độ cứng · (t + số hạng cong)", [
        piece(num(chain.rigidity, 1), "độ cứng vừa tính"),
        piece(" · ("),
        piece(num(chain.t, 12), "t vừa tính"),
        piece(" + "),
        piece(num(chain.curvatureTerm, 12), "số hạng cong vừa tính"),
        piece(")"),
      ], num(chain.omega, 6), "Hệ số ω của B.0.3."),
      equation("số hạng đá balast = 4 · Q / π³", [
        piece("4 · "),
        piece(num(chain.ballast), "Q vừa đổi, N/cm"),
        piece(" / π³"),
      ], num(chain.ballastTerm, 6), "Phần sức cản ngang của nền, N/cm."),
      equation("mẫu số = số hạng đá balast − ω · t / f", [
        piece(num(chain.ballastTerm, 6), "số hạng đá balast"),
        piece(" − "),
        piece(num(chain.omega, 6), "ω"),
        piece(" · "),
        piece(num(chain.t, 12), "t"),
        piece(" / "),
        piece(num(chain.f, 1), "f, cm"),
      ], num(chain.denominator, 6), "Mẫu số của nửa bước sóng. Phải dương."),
      equation("trong căn = ω² + mẫu số · f · độ cứng", [
        piece(`${num(chain.omega, 6)}²`, "ω vừa tính"),
        piece(" + "),
        piece(num(chain.denominator, 6), "mẫu số"),
        piece(" · "),
        piece(num(chain.f, 1), "f"),
        piece(" · "),
        piece(num(chain.rigidity, 1), "độ cứng"),
      ], num(chain.radical, 1), "Biểu thức trong căn của l²."),
      equation("l² = (ω + √(trong căn)) / mẫu số", [
        piece(num(chain.omega, 6), "ω"),
        piece(" + √"),
        piece(num(chain.radical, 1), "trong căn vừa tính"),
        piece(") / "),
        piece(num(chain.denominator, 6), "mẫu số"),
      ], `${num(chain.halfWaveSquared, 1)} cm²`, "Bình phương nửa bước sóng, cm²."),
      equation("f₀ = t · l²", [
        piece(num(chain.t, 12), "t"),
        piece(" · "),
        piece(num(chain.halfWaveSquared, 1), "l² vừa tính"),
      ], `${num(chain.foe, 6)} cm`, "Độ võng tương đương f₀, cm."),
      equation("Pw = (độ cứng · (f + f₀) / l² + số hạng đá balast · l²) / (f + f₀ + số hạng cong · l²)", [
        piece(num(chain.rigidity, 1), "độ cứng"),
        piece(", f "),
        piece(num(chain.f, 1), "f, cm"),
        piece(", f₀ "),
        piece(num(chain.foe, 6), "f₀ vừa tính"),
        piece(", l² "),
        piece(num(chain.halfWaveSquared, 1), "l²"),
        piece(", đá balast "),
        piece(num(chain.ballastTerm, 6), "số hạng đá balast"),
        piece(", số hạng cong "),
        piece(num(chain.curvatureTerm, 12), "số hạng cong"),
      ], `${num(result.criticalForce, 1)} N`, "Lực nén tới hạn hai ray Pw, N."),
      equation("[P] = Pw / K", [
        piece(num(result.criticalForce / 1000), "Pw vừa tính, đổi ra kN"),
        piece(" / "),
        piece(num(input.safety), `${from.rail}: hệ số an toàn K`),
      ], `${num(result.allowedForce / 1000)} kN`, "Chia Pw cho K ra lực nén cho phép, kN."),
      equation("[ΔTu] = [P] / (2 · E · α · F)", [
        piece(num(result.allowedForce, 1), "[P] vừa tính, N"),
        piece(" / (2 · "),
        piece(num(input.steelModulus, 1), `${from.rail}: E, N/mm²`),
        piece(" · "),
        piece(num(input.expansion, 8), `${from.rail}: hệ số giãn nở α`),
        piece(" · "),
        piece(num(input.area, 1), `${from.rail}: diện tích một ray F`),
        piece(")"),
      ], `${num(result.riseUniform)} °C`, "Ra biên độ tăng nhiệt cho phép theo B.0.3, °C."),
    ],
  });

  const irregularRiseItem: WorkedItem = result.riseIrregular === null || result.irregularMinP === null || !input.irregular
    ? item({
      id: "rise-b04",
      label: "[ΔTu] theo B.0.4",
      display: "Không dùng. Phương pháp đang chọn là B.0.3.",
      formula: "Chỉ tính khi phương pháp đang chọn có B.0.4.",
      lines: ["Ô phương pháp đang là bước sóng đều."],
      conclusion: "Không có số B.0.4 trong lần tính này.",
    })
    : item({
      id: "rise-b04",
      label: "[ΔTu] theo B.0.4",
      display: `${num(result.riseIrregular)} °C`,
      steps: [
        ...(result.irregularWave ? waveLines(result.irregularWave, input.irregular, from.rail, from.ballast, from.fastener) : []),
        equation("ΔT = (Pmin / 2 − ΔP) / (E · α · F)", [
          piece(`(${num(result.irregularMinP, 1)}`, `Pmin của phép quét B.0.4, N, tại l = ${num(result.irregularHalfWave ?? 0, 1)} cm. q₀, B, Z, C, N lấy từ ${from.ballast}. H và μ lấy từ ${from.fastener}`),
          piece(" / 2 − "),
          piece(num(input.irregular.dpKn * 1000, 1), `${from.rail}: ΔP của B.0.4-3, đổi kN sang N`),
          piece(") / ("),
          piece(num(input.steelModulus, 1), `${from.rail}: E`),
          piece(" · "),
          piece(num(input.expansion, 8), `${from.rail}: α`),
          piece(" · "),
          piece(num(input.area, 1), `${from.rail}: diện tích F`),
          piece(")"),
        ], `${num((result.irregularMinP / 2 - input.irregular.dpKn * 1000) / (input.steelModulus * input.expansion * input.area))} °C`),
        input.radius === 0 || input.radius >= 2000
          ? equation("[ΔTu] = ΔT − 8", [
            piece(num((result.irregularMinP / 2 - input.irregular.dpKn * 1000) / (input.steelModulus * input.expansion * input.area)), "ΔT vừa tính"),
            piece(" − "),
            piece("8", "Đường thẳng hoặc R ≥ 2.000 m thì trừ 8 °C theo quy ước bảng tính"),
          ], `${num(result.riseIrregular)} °C`)
          : equation("[ΔTu] = ΔT", [
            piece(num(result.riseIrregular), `Không trừ 8 °C vì R = ${num(input.radius, 1)} m, lấy từ ô bán kính cong`),
          ], `${num(result.riseIrregular)} °C`),
      ],
    });

  const selectedRise: WorkedItem = item({
    id: "rise-selected",
    label: "Biên độ tăng nhiệt cho phép [ΔTu] đã chọn",
    display: `${num(result.riseLimit)} °C`,
    steps: [
      equation(
        result.riseMethod === "min" ? "[ΔTu] = min(B.0.3, B.0.4)" : result.riseMethod === "uniform" ? "[ΔTu] = [ΔTu] B.0.3" : "[ΔTu] = [ΔTu] B.0.4",
        [
          piece(num(result.riseUniform), "Kết quả B.0.3 vừa tính"),
          piece(result.riseIrregular === null ? "" : " và "),
          piece(result.riseIrregular === null ? "không tính B.0.4" : num(result.riseIrregular), result.riseIrregular === null ? "Ô phương pháp đang là bước sóng đều" : "Kết quả B.0.4 vừa tính"),
        ],
        `${num(result.riseLimit)} °C`,
      ),
    ],
    lines: [`Ô Phương pháp [ΔTu] ổn định đang chọn: ${methodLabel}.`],
  });

  const compressionItem: WorkedItem = item({
    id: "pt",
    label: "Lực nén nhiệt hai ray Pt",
    display: `${num(compression / 1000)} kN`,
    steps: [
      equation("ΔTu,max = Tmax − Te + biên độ", [
        piece(num(input.maxRailTemperature), `${from.climate}: Tmax ray = Tmax không khí của tháng đã chọn + 20 °C`),
        piece(" − "),
        piece(num(te), inside ? "Te nằm trong khoảng khóa" : "Te tính thử, đang nằm ngoài khoảng"),
        piece(" + "),
        piece(num(input.lockTolerance), "Ô Biên độ khóa"),
      ], `${num(riseActual)} °C`),
      equation("Pt = 2 · E · F · α · ΔTu,max", [
        piece("2 · "),
        piece(num(input.steelModulus, 1), `${from.rail}: E`),
        piece(" · "),
        piece(num(input.area, 1), `${from.rail}: diện tích F`),
        piece(" · "),
        piece(num(input.expansion, 8), `${from.rail}: α`),
        piece(" · "),
        piece(num(riseActual), "ΔTu,max vừa tính"),
      ], `${num(compression, 1)} N = ${num(compression / 1000)} kN`),
    ],
  });

  const ratioItem: WorkedItem = item({
    id: "eta",
    label: "Hệ số sử dụng ổn định η",
    display: `${passedRise && inside ? "ĐẠT" : "KHÔNG ĐẠT"} — η = ${num(useRatio)} theo [ΔTu] đã chọn`,
    steps: [
      equation("η = ΔTu,max / [ΔTu]", [
        piece(num(riseActual), "ΔTu,max vừa tính tại Te"),
        piece(" / "),
        piece(num(result.riseLimit), "[ΔTu] đã chọn theo ô phương pháp ổn định"),
      ], num(useRatio)),
      equation("Pt / [P] =", [
        piece(num(compression / 1000), "Pt vừa tính, kN"),
        piece(" / "),
        piece(num(result.allowedForce / 1000), "[P] của B.0.3. Chỉ khống chế khi phương pháp đang chọn là B.0.3 và không có lực nén dọc bổ sung"),
      ], num(forceRatio)),
    ],
    lines: [inside && passedRise ? "η ≤ 1 và Te nằm trong khoảng." : "Chưa đồng thời thỏa η ≤ 1 và Te nằm trong khoảng."],
  });

  const dropGap: WorkedItem = item({
    id: "drop-gap",
    label: "Giảm nhiệt cho phép theo khe đứt [ΔT khe]",
    display: `${num(result.dropGap)} °C`,
    steps: [
      equation("λ · r / (E · F)", [
        piece(num(input.gapLimit, 1), "Ô Giới hạn khe đứt λ, mm"),
        piece(" · "),
        piece(num(input.resistance), `${from.track}: sức cản dọc r. Đơn vị kN/(m·ray) dùng bằng N/mm`),
        piece(" / ("),
        piece(num(input.steelModulus, 1), `${from.rail}: E`),
        piece(" · "),
        piece(num(input.area, 1), `${from.rail}: diện tích F`),
        piece(")"),
      ], num(input.gapLimit * input.resistance / (input.steelModulus * input.area), 8), "Thương trong dấu căn. Đơn vị không thứ nguyên khi r lấy bằng N/mm."),
      equation("√(λ · r / (E · F))", [
        piece(num(input.gapLimit * input.resistance / (input.steelModulus * input.area), 8), "thương vừa tính"),
      ], num(Math.sqrt(input.gapLimit * input.resistance / (input.steelModulus * input.area)), 8), "Lấy căn bậc hai của thương vừa có."),
      equation("[ΔT khe] = √(λ · r / (E · F)) / α", [
        piece(num(Math.sqrt(input.gapLimit * input.resistance / (input.steelModulus * input.area)), 8), "căn vừa tính"),
        piece(" / "),
        piece(num(input.expansion, 8), `${from.rail}: hệ số giãn nở α, 1/°C`),
      ], `${num(result.dropGap)} °C`, "Chia căn cho α ra biên độ giảm nhiệt, °C."),
    ],
  });

  const gapItem: WorkedItem = item({
    id: "gap",
    label: "Khe đứt ray tính toán",
    display: `${passedGap ? "ĐẠT" : "KHÔNG ĐẠT"} — ${num(gapActual)} mm so với ${num(input.gapLimit, 1)} mm`,
    steps: [
      equation("α · ΔTd,max", [
        piece(num(input.expansion, 8), `${from.rail}: α, 1/°C`),
        piece(" · "),
        piece(num(dropActual), "ΔTd,max tại tâm khóa, °C"),
      ], num(input.expansion * dropActual, 8), "Nhân α với biên độ giảm nhiệt. Kết quả không thứ nguyên."),
      equation("(α · ΔTd,max)²", [
        piece(num(input.expansion * dropActual, 8), "tích vừa tính"),
      ], num((input.expansion * dropActual) ** 2, 8), "Bình phương tích vừa có."),
      equation("λ = E · F · (α · ΔTd,max)² / r", [
        piece(num(input.steelModulus, 1), `${from.rail}: E`),
        piece(" · "),
        piece(num(input.area, 1), `${from.rail}: diện tích F`),
        piece(" · "),
        piece(num((input.expansion * dropActual) ** 2, 8), "bình phương vừa tính"),
        piece(" / "),
        piece(num(input.resistance), `${from.track}: sức cản dọc r, dùng bằng N/mm`),
      ], `${passedGap ? "ĐẠT" : "KHÔNG ĐẠT"} — ${num(gapActual)} mm so với giới hạn ${num(input.gapLimit, 1)} mm`, "Ra khe đứt tính toán, mm, rồi so với giới hạn đã nhập."),
    ],
    lines: inside ? undefined : ["Tâm khóa tính thử nằm ngoài khoảng khóa. Khe đứt vẫn tính theo ΔTd,max của tâm khóa đó."],
  });

  const lockItem: WorkedItem = item({
    id: "lock",
    label: "Nhiệt độ khóa Te",
    display: inside
      ? `ĐẠT — ${num(result.lockTemperature)} °C, khoảng ${num(result.lockMin)} đến ${num(result.lockMax)} °C`
      : `KHÔNG ĐẠT — tâm thử ${num(result.candidate)} °C nằm ngoài ${num(result.lockMin)} đến ${num(result.lockMax)} °C`,
    steps: [
      equation("Tmax − [ΔTu]", [
        piece(num(input.maxRailTemperature), `${from.climate}: Tmax ray`),
        piece(" − "),
        piece(num(result.riseLimit), "[ΔTu] đã chọn"),
      ], `${num(input.maxRailTemperature - result.riseLimit)} °C`, "Cận tăng nhiệt trước khi lấy max."),
      equation("max(Tmin, Tmax − [ΔTu])", [
        piece(num(input.minRailTemperature), `${from.climate}: Tmin ray`),
        piece(" và "),
        piece(num(input.maxRailTemperature - result.riseLimit), "Tmax − [ΔTu] vừa tính"),
      ], `${num(Math.max(input.minRailTemperature, input.maxRailTemperature - result.riseLimit))} °C`, "Lấy số lớn hơn trong hai vế, °C."),
      equation("Cận dưới = max(Tmin, Tmax − [ΔTu]) + biên độ", [
        piece(num(Math.max(input.minRailTemperature, input.maxRailTemperature - result.riseLimit)), "max vừa tính"),
        piece(" + "),
        piece(num(input.lockTolerance), "Ô Biên độ khóa, °C"),
      ], `${num(result.lockMin)} °C`, "Cộng biên độ khóa ra cận dưới của Te, °C."),
      equation("min([ΔTd], [ΔT khe])", [
        piece(num(result.dropStrength), "[ΔTd] theo cường độ, °C"),
        piece(" và "),
        piece(num(result.dropGap), "[ΔT khe], °C"),
      ], `${num(coldLimit)} °C`, "Lấy biên độ giảm nhiệt nhỏ hơn, °C."),
      equation("Tmin + min([ΔTd], [ΔT khe])", [
        piece(num(input.minRailTemperature), `${from.climate}: Tmin ray`),
        piece(" + "),
        piece(num(coldLimit), "min vừa tính"),
      ], `${num(input.minRailTemperature + coldLimit)} °C`, "Cộng Tmin với biên độ giảm nhiệt nhỏ hơn."),
      equation("min(Tmax, Tmin + min([ΔTd], [ΔT khe]))", [
        piece(num(input.maxRailTemperature), `${from.climate}: Tmax ray`),
        piece(" và "),
        piece(num(input.minRailTemperature + coldLimit), "Tmin + min vừa tính"),
      ], `${num(Math.min(input.maxRailTemperature, input.minRailTemperature + coldLimit))} °C`, "Lấy số nhỏ hơn trong hai vế, °C."),
      equation("Cận trên = min(Tmax, Tmin + min([ΔTd], [ΔT khe])) − biên độ", [
        piece(num(Math.min(input.maxRailTemperature, input.minRailTemperature + coldLimit)), "min vừa tính"),
        piece(" − "),
        piece(num(input.lockTolerance), "Ô Biên độ khóa, °C"),
      ], `${num(result.lockMax)} °C`, "Trừ biên độ khóa ra cận trên của Te, °C."),
      equation("Te = (Tmax + Tmin + [ΔTd] − [ΔTu]) / 2 + hiệu chỉnh", [
        piece(num(input.maxRailTemperature), `${from.climate}: Tmax ray`),
        piece(" + "),
        piece(num(input.minRailTemperature), `${from.climate}: Tmin ray`),
        piece(" + "),
        piece(num(result.dropStrength), "[ΔTd] theo cường độ"),
        piece(" − "),
        piece(num(result.riseLimit), "[ΔTu] đã chọn"),
        piece(") / 2 + "),
        piece(num(input.lockAdjustment), "Ô Hiệu chỉnh tâm khóa"),
      ], inside ? `${num(result.lockTemperature)} °C` : `Không lấy ${num(result.candidate)} °C`),
    ],
  });

  const answerOnly = (entry: WorkedItem): WorkedItem => ({ ...entry, steps: undefined, formula: undefined, lines: undefined });
  const stabilityItems = [
    ...(result.riseMethod !== "irregular" ? [uniformRise] : []),
    ...(result.riseIrregular !== null ? [irregularRiseItem] : []),
    selectedRise,
    compressionItem,
    ratioItem,
  ];

  return [
    {
      id: "summary",
      title: "Tổng hợp",
      scope: "Kết quả cần đọc",
      items: [answerOnly(strengthCheck), answerOnly(selectedRise), answerOnly(lockItem), answerOnly(gapItem)],
    },
    {
      id: "strength",
      title: "Bảng tính 1 · Cường độ",
      scope: "Ứng suất đế, ứng suất nhiệt và so với [σ]",
      items: [moment, dynamicMoment, baseStress, allowable, dropStrength, strengthCheck],
      table: {
        caption: "Nội lực tại từng mặt cắt bánh. M₀ lấy ở dòng mô men lớn nhất.",
        headers: ["Vị trí (m)", "P động (kN)", "M tĩnh (kN·m)", "Độ lún (mm)", "Phản lực gối (kN)"],
        rows: result.sections.map((section) => [
          num(section.position),
          num(section.dynamicLoad),
          num(section.moment / 1e6),
          num(section.settlement),
          num(section.seatLoad),
        ]),
        forces: result.sections.map((section) => section.terms.map((term) => ({
          axle: num(term.position),
          pn: num(term.settlementTerm, 4),
          pmu: num(term.momentTerm, 4),
          sumPn: num(section.settlementSum, 4),
          sumPmu: num(section.momentSum, 4),
        }))),
        details: result.sections.map((section) => sectionLines(section, result.k, result.foundation, spacingMm, from.scheme)),
      },
    },
    {
      id: "stability",
      title: "Bảng tính 2 · Ổn định",
      scope: "Biên độ tăng nhiệt của phương pháp đang chọn",
      items: stabilityItems,
    },
    {
      id: "lock",
      title: "Bảng tính 3 · Nhiệt độ khóa đường",
      scope: "Tâm khóa và hai cận",
      items: [lockItem],
    },
    {
      id: "gap",
      title: "Bảng tính 4 · Khe đứt ray",
      scope: "Biên độ giảm nhiệt theo khe và khe tính được",
      items: [dropGap, gapItem],
    },
  ];
}
