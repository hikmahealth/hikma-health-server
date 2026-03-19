import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import If from "../../src/components/if";

describe("If Component", () => {
  it("should render children when show is true", () => {
    render(
      <If show={true}>
        <div data-testid="test-child">Test Content</div>
      </If>,
    );

    const child = screen.getByTestId("test-child");
    expect(child).toBeTruthy();
    expect(child.textContent).toBe("Test Content");
  });

  it("should not render children when show is false", () => {
    render(
      <If show={false}>
        <div data-testid="test-child">Test Content</div>
      </If>,
    );

    const child = screen.queryByTestId("test-child");
    expect(child).toBeNull();
  });

  it("should render text children when show is true", () => {
    render(<If show={true}>Simple text content</If>);

    expect(screen.getByText("Simple text content")).toBeTruthy();
  });

  it("should not render text children when show is false", () => {
    render(<If show={false}>Simple text content</If>);

    expect(screen.queryByText("Simple text content")).toBeNull();
  });

  it("should render multiple children when show is true", () => {
    render(
      <If show={true}>
        <div data-testid="first-child">First</div>
        <div data-testid="second-child">Second</div>
        <span data-testid="third-child">Third</span>
      </If>,
    );

    expect(screen.getByTestId("first-child")).toBeTruthy();
    expect(screen.getByTestId("second-child")).toBeTruthy();
    expect(screen.getByTestId("third-child")).toBeTruthy();
  });

  it("should not render multiple children when show is false", () => {
    render(
      <If show={false}>
        <div data-testid="first-child">First</div>
        <div data-testid="second-child">Second</div>
        <span data-testid="third-child">Third</span>
      </If>,
    );

    expect(screen.queryByTestId("first-child")).toBeNull();
    expect(screen.queryByTestId("second-child")).toBeNull();
    expect(screen.queryByTestId("third-child")).toBeNull();
  });

  it("should handle nested If components", () => {
    render(
      <If show={true}>
        <div data-testid="outer">
          Outer content
          <If show={true}>
            <div data-testid="inner">Inner content</div>
          </If>
        </div>
      </If>,
    );

    expect(screen.getByTestId("outer")).toBeTruthy();
    expect(screen.getByTestId("inner")).toBeTruthy();
  });

  it("should not render nested If component when inner show is false", () => {
    render(
      <If show={true}>
        <div data-testid="outer">
          Outer content
          <If show={false}>
            <div data-testid="inner">Inner content</div>
          </If>
        </div>
      </If>,
    );

    expect(screen.getByTestId("outer")).toBeTruthy();
    expect(screen.queryByTestId("inner")).toBeNull();
  });

  it("should not render anything when outer If show is false", () => {
    render(
      <If show={false}>
        <div data-testid="outer">
          Outer content
          <If show={true}>
            <div data-testid="inner">Inner content</div>
          </If>
        </div>
      </If>,
    );

    expect(screen.queryByTestId("outer")).toBeNull();
    expect(screen.queryByTestId("inner")).toBeNull();
  });

  it("should handle dynamic show prop changes", () => {
    const { rerender } = render(
      <If show={true}>
        <div data-testid="dynamic-child">Dynamic Content</div>
      </If>,
    );

    // Initially visible
    expect(screen.getByTestId("dynamic-child")).toBeTruthy();

    // Change to false
    rerender(
      <If show={false}>
        <div data-testid="dynamic-child">Dynamic Content</div>
      </If>,
    );
    expect(screen.queryByTestId("dynamic-child")).toBeNull();

    // Change back to true
    rerender(
      <If show={true}>
        <div data-testid="dynamic-child">Dynamic Content</div>
      </If>,
    );
    expect(screen.getByTestId("dynamic-child")).toBeTruthy();
  });

  it("should handle null and undefined children gracefully", () => {
    const { container } = render(
      <If show={true}>
        {null}
        {undefined}
      </If>,
    );

    // Should render without errors but with empty content
    expect(container.textContent).toBe("");
  });

  it("should render fragments as children", () => {
    render(
      <If show={true}>
        <>
          <div data-testid="fragment-1">Fragment 1</div>
          <div data-testid="fragment-2">Fragment 2</div>
        </>
      </If>,
    );

    expect(screen.getByTestId("fragment-1")).toBeTruthy();
    expect(screen.getByTestId("fragment-2")).toBeTruthy();
  });

  it("should handle complex component children", () => {
    const ComplexChild = () => (
      <div data-testid="complex">
        <span>Nested content</span>
      </div>
    );

    render(
      <If show={true}>
        <ComplexChild />
      </If>,
    );

    expect(screen.getByTestId("complex")).toBeTruthy();
  });

  it("should not render complex component children when show is false", () => {
    const ComplexChild = () => (
      <div data-testid="complex">
        <span>Nested content</span>
      </div>
    );

    render(
      <If show={false}>
        <ComplexChild />
      </If>,
    );

    expect(screen.queryByTestId("complex")).toBeNull();
  });

  it("should handle boolean conversion correctly", () => {
    // Test with truthy values
    const { rerender } = render(
      <If show={1 as unknown as boolean}>
        <div data-testid="bool-test">Content</div>
      </If>,
    );
    expect(screen.getByTestId("bool-test")).toBeTruthy();

    // Test with falsy values
    rerender(
      <If show={0 as unknown as boolean}>
        <div data-testid="bool-test">Content</div>
      </If>,
    );
    expect(screen.queryByTestId("bool-test")).toBeNull();
  });
});
