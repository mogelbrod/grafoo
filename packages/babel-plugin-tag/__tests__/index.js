import * as babel from "@babel/core";

import plugin from "../src";

const transform = (program, opts) =>
  babel.transform(program, {
    plugins: [[plugin, Object.assign({ schema: "__tests__/schema.graphql" }, opts)]]
  });

afterEach(() => {
  process.env.NODE_ENV = "test";
});

test("should throw if a import is not default", () => {
  const program = 'import { gql } from "@grafoo/core/tag";';

  expect(() => transform(program)).toThrow();
});

test("should remove the imported path", () => {
  const program = 'import gql from "@grafoo/core/tag";';

  expect(transform(program).code).toBe("");
});

test("should throw if a schema is not specified", () => {
  const program = `
    import gql from "@grafoo/core/tag";
    const query = gql\`{ hello }\`;
  `;

  expect(() => transform(program, { schema: undefined })).toThrow();
});

test("should throw if a schema path points to a inexistent file", () => {
  const program = `
    import gql from "@grafoo/core/tag";
    const query = gql\`{ hello }\`;
  `;

  expect(() => transform(program, { schema: "?" })).toThrow();
});

test("should throw if a tagged template string literal has expressions in it", () => {
  const program = `
    import gql from "@grafoo/core/tag";
    const id = 1;
    const query = gql\`{ user(id: "\${id}") { name } }\`;
  `;

  expect(() => transform(program)).toThrow();
});

test("should replace a tagged template literal with the compiled grafoo object", () => {
  const program = `
    import gql from "@grafoo/core/tag";
    const query = gql\`
      query($start: Int!, $offset: Int!, $id: ID!) {
        posts(start: $start, offset: $offset) {
          title
          body
          createdAt
          tags { name }
          authors { name username }
        }
        user(id: $id) { name username }
      }
    \`;
  `;

  expect(transform(program, { fieldsToInsert: ["id"] }).code).toMatchSnapshot();
});

test("should compress query in production", () => {
  const program = `
    import gql from "@grafoo/core/tag";
    const query = gql\`
      query($start: Int!, $offset: Int!, $id: ID!) {
        posts(start: $start, offset: $offset) {
          title
          body
          createdAt
          tags { name }
          authors { name username }
        }
        user(id: $id) { name username }
      }
    \`;
  `;

  process.env.NODE_ENV = "production";

  expect(transform(program, { fieldsToInsert: ["id"] }).code).toMatchSnapshot();
});