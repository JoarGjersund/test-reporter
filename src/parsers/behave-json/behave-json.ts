import { ParseOptions, TestParser } from '../../test-parser'
import {
  TestCaseError,
  TestCaseResult,
  TestExecutionResult,
  TestGroupResult,
  TestRunResult,
  TestSuiteResult
} from '../../test-results'
import { getExceptionSource } from '../../utils/node-utils'
import { getBasePath, normalizeFilePath } from '../../utils/path-utils'
import { BehaveJson, BehaveJsonTest } from './behave-json-types'

export class BehaveJsonParser implements TestParser {
  assumedWorkDir: string | undefined

  constructor(readonly options: ParseOptions) { }

  async parse(path: string, content: string): Promise<TestRunResult> {
    const behave = this.getBehaveJson(path, content)
    const result = this.getTestRunResult(path, behave)
    result.sort(true)
    return Promise.resolve(result)
  }

  private getBehaveJson(path: string, content: string): BehaveJson {
    try {
      return JSON.parse(content)
    } catch (e) {
      throw new Error(`Invalid JSON at ${path}\n\n${e}`)
    }
  }

  // New parser for the provided JSON format
  private getTestRunResult(resultsPath: string, behave: any): TestRunResult {
    const suites: TestSuiteResult[] = [];
    let totalDuration = 0;

    if (!behave.features || !Array.isArray(behave.features)) {
      return new TestRunResult(resultsPath, [], 0);
    }

    for (const feature of behave.features) {
      const suiteName = feature.name || feature.filename || "Feature";
      const suitePath = this.getRelativePath(feature.filename || suiteName);
      const suite = new TestSuiteResult(suitePath, []);

      if (feature.scenarios && Array.isArray(feature.scenarios)) {
        for (const scenario of feature.scenarios) {
          // Group by scenario name
          let group = suite.groups.find(g => g.name === scenario.name);
          if (!group) {
            group = new TestGroupResult(scenario.name, []);
            suite.groups.push(group);
          }

          // Determine result status
          let status: TestExecutionResult = "skipped";
          if (scenario.status === "passed" || scenario.status === "success") status = "success";
          else if (scenario.status === "failed" || scenario.status === "error") status = "failed";
          else if (scenario.status === "untested" || scenario.status === "skipped") status = "skipped";

          // Aggregate step errors/details
          let error: TestCaseError | undefined = undefined;
          let stepDetails: string[] = [];
          if (scenario.steps && Array.isArray(scenario.steps)) {
            for (const step of scenario.steps) {
              // If any step is failed, mark scenario as failed
              if (step.status === "failed" || step.status === "error") status = "failed";
              // Collect step details
              stepDetails.push(`${step.step_type}: ${step.name} [${step.status}]`);
              if (step.status === "failed" && !error) {
                error = {
                  path: feature.filename,
                  line: undefined,
                  message: step.name,
                  details: step.text || ""
                };
              }
            }
          }

          // Compose test case
          // Attach step details to error.details if error exists, otherwise skip
          if (error) {
            error.details = (error.details ? error.details + "\n" : "") + stepDetails.join("\n");
          }
          const testCase = new TestCaseResult(
            scenario.name,
            status,
            scenario.duration || 0,
            error
          );
          group.tests.push(testCase);
          totalDuration += scenario.duration || 0;
        }
      }
      suites.push(suite);
    }
    return new TestRunResult(resultsPath, suites, totalDuration);
  }

  private processTest(suite: TestSuiteResult, test: BehaveJsonTest, result: TestExecutionResult): void {
    const groupName =
      test.fullTitle !== test.title
        ? test.fullTitle.substr(0, test.fullTitle.length - test.title.length).trimEnd()
        : null

    let group = suite.groups.find(grp => grp.name === groupName)
    if (group === undefined) {
      group = new TestGroupResult(groupName, [])
      suite.groups.push(group)
    }

    const error = this.getTestCaseError(test)
    const testCase = new TestCaseResult(test.title, result, test.duration ?? 0, error)
    group.tests.push(testCase)
  }

  private getTestCaseError(test: BehaveJsonTest): TestCaseError | undefined {
    const details = test.err.stack
    const message = test.err.message
    if (details === undefined) {
      return undefined
    }

    let path
    let line

    const src = getExceptionSource(details, this.options.trackedFiles, file => this.getRelativePath(file))
    if (src) {
      path = src.path
      line = src.line
    }

    return {
      path,
      line,
      message,
      details
    }
  }

  private getRelativePath(path: string): string {
    path = normalizeFilePath(path)
    const workDir = this.getWorkDir(path)
    if (workDir !== undefined && path.startsWith(workDir)) {
      path = path.substr(workDir.length)
    }
    return path
  }

  private getWorkDir(path: string): string | undefined {
    return (
      this.options.workDir ??
      this.assumedWorkDir ??
      (this.assumedWorkDir = getBasePath(path, this.options.trackedFiles))
    )
  }
}
