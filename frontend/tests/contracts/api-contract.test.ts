import Ajv from "ajv";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import openApi from "./openapi.json";
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
  });

  it.each(earlyFinish.cases)("validates the backend-generated F4 case: $name", (scenario) => {
    assertContract("LabReport", scenario.report);
    expect(scenario.report.analysis.adherence.missing_days).toEqual(scenario.expected.missing_days);
    expect(scenario.report.analysis.adherence.coverage_rate).toBeCloseTo(scenario.expected.coverage_rate, 3);
  });

});
