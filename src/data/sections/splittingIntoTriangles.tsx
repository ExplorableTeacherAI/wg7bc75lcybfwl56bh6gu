import { useEffect, useMemo, useState, type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import {
    EditableH2,
    EditableParagraph,
    InlineClozeInput,
    InlineFeedback,
    InlineLinkedHighlight,
    InteractionHintSequence,
    RevealOnInteraction,
} from "@/components/atoms";
import { Figure } from "@/components/molecules";
import { useVar, useSetVar } from "@/stores";
import {
    getVariableInfo,
    clozePropsFromDefinition,
    linkedHighlightPropsFromDefinition,
} from "../variables";

/* ------------------------------------------------------------------ *
 * A hexagon full of overlapping triangles. Students choose the ones
 * they think make up the shape; doubled patches darken and missed
 * patches stay white, so over-counting is visible rather than told.
 * ------------------------------------------------------------------ */

const VIEW = 400;
const HEX_CENTER = { x: 200, y: 180 };
const HEX_RADIUS = 118;

const TEAL = "#62D0AD";
const INK = "#334155";
const STRUCTURE = "#64748B";
const FAINT = "#CBD5E1";

type Point = { x: number; y: number };

const hexVertex = (index: number): Point => {
    const angle = ((90 - index * 60) * Math.PI) / 180;
    return {
        x: HEX_CENTER.x + HEX_RADIUS * Math.cos(angle),
        y: HEX_CENTER.y - HEX_RADIUS * Math.sin(angle),
    };
};

const HEX_VERTICES = Array.from({ length: 6 }, (_, index) => hexVertex(index));

/** Eight of the triangles hiding in the tangle — four of them tile the shape. */
const CANDIDATES: { id: string; corners: [number, number, number] }[] = [
    { id: "a", corners: [0, 1, 2] },
    { id: "b", corners: [0, 2, 3] },
    { id: "c", corners: [0, 3, 4] },
    { id: "d", corners: [0, 4, 5] },
    { id: "e", corners: [1, 2, 3] },
    { id: "f", corners: [2, 3, 4] },
    { id: "g", corners: [0, 2, 4] },
    { id: "h", corners: [0, 1, 3] },
];

const cornersOf = (candidate: { corners: [number, number, number] }) =>
    candidate.corners.map((index) => HEX_VERTICES[index]);

const centroidOf = (points: Point[]): Point => ({
    x: (points[0].x + points[1].x + points[2].x) / 3,
    y: (points[0].y + points[1].y + points[2].y) / 3,
});

const sign = (p: Point, a: Point, b: Point) => (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y);

const insideTriangle = (p: Point, tri: Point[]) => {
    const d1 = sign(p, tri[0], tri[1]);
    const d2 = sign(p, tri[1], tri[2]);
    const d3 = sign(p, tri[2], tri[0]);
    const hasNegative = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPositive = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNegative && hasPositive);
};

const insideHexagon = (p: Point) => {
    let inside = false;
    for (let i = 0, j = HEX_VERTICES.length - 1; i < HEX_VERTICES.length; j = i++) {
        const a = HEX_VERTICES[i];
        const b = HEX_VERTICES[j];
        if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
            inside = !inside;
        }
    }
    return inside;
};

const pointsAttribute = (points: Point[]) => points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
const formatPercent = (value: number) => `${Math.round(value)}%`;

function HexagonCoverageDrawing() {
    const setVar = useSetVar();
    const selectionText = useVar<string>("hexagonSelection", "");
    const highlight = useVar<string>("hexagonViewHighlight", "");
    const [previewId, setPreviewId] = useState<string | null>(null);

    const selection = useMemo(
        () => selectionText.split(",").map((id) => id.trim()).filter(Boolean),
        [selectionText],
    );

    const coverage = useMemo(() => {
        const chosen = CANDIDATES.filter((candidate) => selection.includes(candidate.id)).map(cornersOf);
        let inside = 0;
        let once = 0;
        let doubled = 0;
        for (let x = HEX_CENTER.x - HEX_RADIUS; x <= HEX_CENTER.x + HEX_RADIUS; x += 5) {
            for (let y = HEX_CENTER.y - HEX_RADIUS; y <= HEX_CENTER.y + HEX_RADIUS; y += 5) {
                const point = { x, y };
                if (!insideHexagon(point)) continue;
                inside += 1;
                let covers = 0;
                for (const triangle of chosen) {
                    if (insideTriangle(point, triangle)) covers += 1;
                }
                if (covers === 1) once += 1;
                else if (covers > 1) doubled += 1;
            }
        }
        if (inside === 0) return { once: 0, doubled: 0, missed: 0 };
        return {
            once: (once / inside) * 100,
            doubled: (doubled / inside) * 100,
            missed: ((inside - once - doubled) / inside) * 100,
        };
    }, [selection]);

    const perfect = coverage.once > 99 && selection.length > 0;

    useEffect(() => {
        setVar("hexagonChosenCount", selection.length);
        setVar("hexagonCoverOnce", Math.round(coverage.once));
    }, [setVar, selection.length, coverage.once]);

    const toggle = (id: string) => {
        const next = selection.includes(id) ? selection.filter((item) => item !== id) : [...selection, id];
        setVar("hexagonSelection", next.join(","));
        setVar("hexagonExplored", true);
    };

    const gridActive = highlight === "grid";
    const recede = gridActive ? 0.35 : 1;
    const ease = { transition: "opacity 150ms ease-out" };

    const diagonals: [number, number][] = [];
    for (let i = 0; i < 6; i += 1) {
        for (let j = i + 2; j < 6; j += 1) {
            if (i === 0 && j === 5) continue;
            diagonals.push([i, j]);
        }
    }

    return (
        <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="block w-full">
            <defs>
                <filter id="hexagon-dot-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            {/* Chosen triangles stack, so doubled patches darken on their own */}
            <g opacity={recede} style={ease}>
                {CANDIDATES.filter((candidate) => selection.includes(candidate.id)).map((candidate) => (
                    <polygon
                        key={`chosen-${candidate.id}`}
                        points={pointsAttribute(cornersOf(candidate))}
                        fill={TEAL}
                        fillOpacity={0.3}
                    />
                ))}
            </g>

            {/* The faint tangle of lines */}
            <g
                opacity={highlight && !gridActive ? 0.35 : 1}
                style={ease}
                onPointerEnter={() => setVar("hexagonViewHighlight", "grid")}
                onPointerLeave={() => setVar("hexagonViewHighlight", "")}
            >
                {gridActive && diagonals.map(([from, to]) => (
                    <line
                        key={`halo-${from}-${to}`}
                        x1={HEX_VERTICES[from].x}
                        y1={HEX_VERTICES[from].y}
                        x2={HEX_VERTICES[to].x}
                        y2={HEX_VERTICES[to].y}
                        stroke={STRUCTURE}
                        strokeWidth={7}
                        opacity={0.22}
                        strokeLinecap="round"
                    />
                ))}
                {diagonals.map(([from, to]) => (
                    <line
                        key={`diagonal-${from}-${to}`}
                        x1={HEX_VERTICES[from].x}
                        y1={HEX_VERTICES[from].y}
                        x2={HEX_VERTICES[to].x}
                        y2={HEX_VERTICES[to].y}
                        stroke={gridActive ? STRUCTURE : FAINT}
                        strokeWidth={gridActive ? 2 : 1}
                        strokeLinecap="round"
                        style={{ transition: "stroke-width 150ms ease-out" }}
                    />
                ))}
            </g>

            <g opacity={recede} style={ease}>
                <polygon
                    points={pointsAttribute(HEX_VERTICES)}
                    fill="none"
                    stroke={perfect ? INK : STRUCTURE}
                    strokeWidth={perfect ? 3 : 2}
                    strokeLinejoin="round"
                    style={{ transition: "stroke-width 150ms ease-out" }}
                />

                {/* Preview outline of the triangle under the pointer */}
                {previewId && (
                    <polygon
                        points={pointsAttribute(cornersOf(CANDIDATES.find((candidate) => candidate.id === previewId)!))}
                        fill={TEAL}
                        fillOpacity={0.12}
                        stroke={TEAL}
                        strokeWidth={2.5}
                        strokeLinejoin="round"
                    />
                )}

                {/* One dot per triangle you can choose */}
                {CANDIDATES.map((candidate) => {
                    const centre = centroidOf(cornersOf(candidate));
                    const chosen = selection.includes(candidate.id);
                    return (
                        <g key={`dot-${candidate.id}`}>
                            <circle
                                cx={centre.x}
                                cy={centre.y}
                                r={chosen ? 8 : 6}
                                fill={chosen ? TEAL : "#FFFFFF"}
                                stroke={chosen ? "#FFFFFF" : STRUCTURE}
                                strokeWidth={2}
                                filter={chosen ? "url(#hexagon-dot-shadow)" : undefined}
                                style={{ transition: "r 150ms ease-out" }}
                            />
                            <circle
                                cx={centre.x}
                                cy={centre.y}
                                r={15}
                                fill="transparent"
                                style={{ cursor: "pointer", touchAction: "none" }}
                                onPointerEnter={() => setPreviewId(candidate.id)}
                                onPointerLeave={() => setPreviewId(null)}
                                onClick={() => toggle(candidate.id)}
                            />
                        </g>
                    );
                })}
            </g>

            {/* Live coverage readout */}
            <g opacity={recede} style={ease}>
                <text x={HEX_CENTER.x} y={344} textAnchor="middle" fontSize="13" fill={STRUCTURE}
                    style={{ fontVariantNumeric: "tabular-nums" }}>
                    {`${selection.length} chosen`}
                </text>
                <text x={HEX_CENTER.x} y={370} textAnchor="middle" fontSize="13"
                    fill={INK} fontWeight={perfect ? 700 : 400}
                    style={{ fontVariantNumeric: "tabular-nums" }}>
                    {perfect
                        ? "every part covered exactly once"
                        : `${formatPercent(coverage.doubled)} doubled · ${formatPercent(coverage.missed)} missed`}
                </text>
            </g>
        </svg>
    );
}

function HexagonCoverageFigure() {
    const setVar = useSetVar();
    return (
        <Figure
            id="hexagon-coverage"
            caption="Each dot marks a triangle hiding in the hexagon. Click a dot to choose that triangle, and click it again to drop it."
            onReset={() => {
                setVar("hexagonSelection", "");
                setVar("hexagonChosenCount", 0);
                setVar("hexagonCoverOnce", 0);
            }}
        >
            <HexagonCoverageDrawing />
            <InteractionHintSequence
                hintKey="hexagon-coverage-click"
                steps={[
                    {
                        gesture: "click",
                        label: "Click a dot to choose that triangle",
                        position: { x: "67%", y: "35%" },
                    },
                ]}
            />
        </Figure>
    );
}

export const splittingIntoTrianglesBlocks: ReactElement[] = [
    <StackLayout key="layout-splitting-heading" maxWidth="xl">
        <Block id="splitting-heading" padding="md">
            <EditableH2 id="h2-splitting-heading" blockId="splitting-heading">
                Splitting a Shape into Triangles
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-splitting-setup" maxWidth="xl">
        <Block id="splitting-setup" padding="sm">
            <EditableParagraph id="para-splitting-setup" blockId="splitting-setup">
                A six-sided tile looks nothing like a triangle, yet it is full of them. Every{" "}
                <InlineLinkedHighlight
                    id="highlight-hexagon-grid"
                    varName="hexagonViewHighlight"
                    highlightId="grid"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo('hexagonViewHighlight'))}
                >
                    faint line
                </InlineLinkedHighlight>
                {" "}across this hexagon makes more of them appear, and each dot picks one out.
                Choose the triangles you think make up the shape, then look for dark patches and
                white gaps.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-splitting-visual" maxWidth="xl">
        <Block id="splitting-visual" padding="sm" hasVisualization>
            <HexagonCoverageFigure />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-splitting-insight" maxWidth="xl">
        <Block id="splitting-insight" padding="sm">
            <EditableParagraph id="para-splitting-insight" blockId="splitting-insight">
                Here is the slippery part: plenty of these triangles sit on top of one another, and
                it is tempting to count them all. The set that works fans out from a single corner
                and covers every part of the hexagon exactly once, with nothing doubled and nothing
                missed.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-splitting-hexagon-count" maxWidth="xl">
        <Block id="splitting-hexagon-count" padding="sm">
            <EditableParagraph id="para-splitting-hexagon-count" blockId="splitting-hexagon-count">
                <RevealOnInteraction varName="hexagonExplored">
                    Fanned out from one corner, a hexagon is covered exactly once by{" "}
                    <InlineFeedback
                        varName="answerHexagonTriangles"
                        correctValue={["4", "four"]}
                        position="terminal"
                        successMessage="— yes, four triangles and not one more"
                        failureMessage="— not quite."
                        hint="A choice that leaves dark patches has too many triangles, and white gaps mean too few"
                        visualizationHint={{
                            blockId: "splitting-visual",
                            hintKey: "feedback-hexagon-coverage",
                            label: "Discover it yourself",
                            resetVars: { hexagonSelection: "", hexagonChosenCount: 0, hexagonCoverOnce: 0 },
                            steps: [
                                {
                                    gesture: "click",
                                    label: "Click one dot and watch the readout underneath",
                                    position: { x: "67%", y: "35%" },
                                    completionVar: "hexagonChosenCount",
                                    completionValue: 1,
                                    completionTolerance: 0.4,
                                },
                                {
                                    gesture: "click",
                                    label: "Keep choosing until nothing is doubled and nothing is missed, then count your dots",
                                    position: { x: "33%", y: "35%" },
                                    completionVar: "hexagonCoverOnce",
                                    completionValue: 100,
                                    completionTolerance: 2,
                                },
                            ],
                        }}
                    >
                        <InlineClozeInput
                            varName="answerHexagonTriangles"
                            correctAnswer={["4", "four"]}
                            {...clozePropsFromDefinition(getVariableInfo('answerHexagonTriangles'))}
                        />
                    </InlineFeedback>
                    {" "}triangles.
                </RevealOnInteraction>
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-splitting-octagon-count" maxWidth="xl">
        <Block id="splitting-octagon-count" padding="sm">
            <EditableParagraph id="para-splitting-octagon-count" blockId="splitting-octagon-count">
                A pentagon gives three triangles and a hexagon gives four, so an eight-sided shape,
                fanned the same way, gives{" "}
                <InlineFeedback
                    varName="answerOctagonTriangles"
                    correctValue={["6", "six"]}
                    position="terminal"
                    successMessage="— exactly, the count always trails the number of sides by two"
                    failureMessage="— have another look."
                    hint="Line the numbers up: 5 sides gives 3, 6 sides gives 4, so what does 8 give"
                    reviewBlockId="splitting-visual"
                    reviewLabel="Back to the hexagon"
                >
                    <InlineClozeInput
                        varName="answerOctagonTriangles"
                        correctAnswer={["6", "six"]}
                        {...clozePropsFromDefinition(getVariableInfo('answerOctagonTriangles'))}
                    />
                </InlineFeedback>
                {" "}triangles.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
