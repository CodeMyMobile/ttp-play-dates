import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LandingPage from "../pages/LandingPage.jsx";

const fillSignupForm = async (user, overrides = {}) => {
  const nameInput = screen.getByLabelText(/full name/i);
  const emailInput = screen.getByLabelText(/^email address/i);
  const phoneInput = screen.getByLabelText(/cell phone/i);
  const passwordInput = screen.getByLabelText(/password/i);
  const skillSelect = screen.getByLabelText(/skill level/i);

  await user.clear(nameInput);
  await user.type(nameInput, overrides.name ?? "Serena Williams");
  await user.clear(emailInput);
  await user.type(emailInput, overrides.email ?? "serena@example.com");
  await user.clear(phoneInput);
  await user.type(phoneInput, overrides.phone ?? "5551234567");
  await user.clear(passwordInput);
  await user.type(passwordInput, overrides.password ?? "matchplay1");
  await user.selectOptions(skillSelect, overrides.skillLevel ?? "advanced");
};

describe("LandingPage", () => {
  it("shows validation errors before submitting the sign up form", async () => {
    const user = userEvent.setup();
    const signup = vi.fn();

    render(<LandingPage onSignup={signup} onLogin={vi.fn()} onForgotPassword={vi.fn()} />);

    const submit = screen.getByRole("button", { name: /create free account/i });
    await user.click(submit);

    expect(signup).not.toHaveBeenCalled();
    expect(screen.getByText(/please enter your full name/i)).toBeInTheDocument();
    expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument();
    expect(screen.getByText(/enter a 10 digit phone number/i)).toBeInTheDocument();
    expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/select your skill level/i)).toBeInTheDocument();
  });

  it("submits sign up data when all fields are valid", async () => {
    const user = userEvent.setup();
    const signup = vi.fn().mockResolvedValue({});

    render(<LandingPage onSignup={signup} onLogin={vi.fn()} onForgotPassword={vi.fn()} />);

    await fillSignupForm(user);

    const submit = screen.getByRole("button", { name: /create free account/i });
    await user.click(submit);

    expect(signup).toHaveBeenCalledTimes(1);
    expect(signup).toHaveBeenCalledWith({
      name: "Serena Williams",
      email: "serena@example.com",
      phone: "(555) 123-4567",
      password: "matchplay1",
      skillLevel: "advanced",
    });
  });

  it("surfaces api error messages for sign up", async () => {
    const user = userEvent.setup();
    const signup = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("Email already used"), { fieldErrors: { email: "In use" } }));

    render(<LandingPage onSignup={signup} onLogin={vi.fn()} onForgotPassword={vi.fn()} />);

    await fillSignupForm(user);

    const submit = screen.getByRole("button", { name: /create free account/i });
    await user.click(submit);

    expect(await screen.findByRole("alert")).toHaveTextContent(/email already used/i);
    expect(screen.getByText(/in use/i)).toBeInTheDocument();
  });

  it("allows signing in and displays api errors", async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockRejectedValue(new Error("Invalid credentials"));

    render(<LandingPage onSignup={vi.fn()} onLogin={login} onForgotPassword={vi.fn()} />);

    const signInTab = screen.getByRole("tab", { name: /sign in/i });
    await user.click(signInTab);

    const form = screen.getByRole("form");
    const emailInput = within(form).getByLabelText(/email address/i);
    const passwordInput = within(form).getByLabelText(/password/i);

    await user.type(emailInput, "venus@example.com");
    await user.type(passwordInput, "tennis123");

    const submit = within(form).getByRole("button", { name: /sign in/i });
    await user.click(submit);

    expect(login).toHaveBeenCalledWith({ email: "venus@example.com", password: "tennis123" });
    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid credentials/i);
  });

  it("sends forgot password requests", async () => {
    const user = userEvent.setup();
    const forgot = vi.fn().mockResolvedValue({});

    render(<LandingPage onSignup={vi.fn()} onLogin={vi.fn()} onForgotPassword={forgot} />);

    const signInTab = screen.getByRole("tab", { name: /sign in/i });
    await user.click(signInTab);

    const form = screen.getByRole("form");
    const emailInput = within(form).getByLabelText(/email address/i);
    await user.type(emailInput, "naomi@example.com");

    const forgotButton = within(form).getByRole("button", { name: /forgot password/i });
    await user.click(forgotButton);

    expect(forgot).toHaveBeenCalledWith("naomi@example.com");
    expect(await screen.findByRole("status")).toHaveTextContent(/reset link is on the way/i);
  });
});
