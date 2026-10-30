import Ajv from "ajv";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import openApi from "@rhythm-health/contract/openapi.json";
import {
  ACTIVITY_LEVELS,
  AGE_RANGES,
  CATEGORIES,
  MAX_LIST_ITEMS,
  MAX_LIST_ITEM_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_SLEEP_HOURS,
  MIN_SLEEP_HOURS,
} from "@rhythm-health/contract";
import earlyFinish from "../support/early-finish-reports.json";
import {
  experiment,
  labReport,
  writtenLabReport,
  profile,
  profileInput,
  proposeResponse,
  proposal,
  prediction,
  saveExperimentRequest,
} from "../support/fixtures";

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
ajv.addSchema(openApi, "rhythm-health-openapi.json");

function assertContract(component: string, value: unknown) {
  const validate = ajv.getSchema(`rhythm-health-openapi.json#/components/schemas/${component}`);
  expect(validate, `missing FastAPI schema component ${component}`).toBeDefined();
  const valid = validate?.(value) ?? false;
  expect(valid, ajv.errorsText(validate?.errors)).toBe(true);
}

describe("frontend API fixtures follow FastAPI's OpenAPI schema", () => {
  it("keeps shared form choices aligned with backend enums", () => {
    const { ProfileIn, Classification } = openApi.components.schemas;
    expect(AGE_RANGES).toEqual(ProfileIn.properties.age_range.enum);
    expect(ACTIVITY_LEVELS).toEqual(ProfileIn.properties.activity_level.enum);
    expect(CATEGORIES).toEqual(Classification.properties.category.enum);
  });

  it("keeps shared form limits aligned with backend validation", () => {
    const { ProfileIn, CheckinIn } = openApi.components.schemas;
    expect(MIN_SLEEP_HOURS).toBe(ProfileIn.properties.usual_sleep_hours.minimum);
    expect(MAX_SLEEP_HOURS).toBe(ProfileIn.properties.usual_sleep_hours.maximum);
    for (const field of ["goals", "regular_habits", "constraints"] as const) {
      expect(MAX_LIST_ITEMS).toBe(ProfileIn.properties[field].maxItems);
      expect(MAX_LIST_ITEM_LENGTH).toBe(ProfileIn.properties[field].items.maxLength);
    }
    expect(MAX_NOTE_LENGTH).toBe(CheckinIn.properties.note.anyOf[0].maxLength);
  });

  it("validates the profile request and response", () => {
    assertContract("ProfileIn", profileInput);
    assertContract("ProfileOut", profile);
  });

  it("validates proposal and experiment request and response bodies", () => {
    assertContract("ProposeResponse", proposeResponse);
    assertContract("ExperimentProposal", proposal);
    assertContract("Prediction", prediction);
    assertContract("SaveExperimentRequest", saveExperimentRequest);
    assertContract("ExperimentOut", experiment);
  });

  it("validates the Lab Report with and without the written narrative", () => {
    assertContract("LabReport", labReport);
    assertContract("LabReport", writtenLabReport);
    assertContract("ReportNarrative", writtenLabReport.narrative);
    assertContract("ChartData", labReport.chart);
  });

  it("validates the demo reset request and its bare LabReport response (B1)", () => {
    assertContract("DemoResetRequest", {});
    assertContract("LabReport", { ...writtenLabReport, experiment: { ...writtenLabReport.experiment, is_seeded: true } });
  });
  it("validates the first-day experiment from the real progress service", () => {
    assertContract("ExperimentOut", earlyFinish.first_day.experiment);
    assertContract("ExperimentTimeline", earlyFinish.first_day.timeline);
  });

  it.each(earlyFinish.cases)("validates the backend-generated F4 case: $name", (scenario) => {
    assertContract("LabReport", scenario.report);
    assertContract("ExperimentTimeline", scenario.timeline);
    expect(scenario.report.analysis.adherence.missing_days).toEqual(scenario.expected.missing_days);
    expect(scenario.report.analysis.adherence.coverage_rate).toBeCloseTo(scenario.expected.coverage_rate, 3);
  });

});
