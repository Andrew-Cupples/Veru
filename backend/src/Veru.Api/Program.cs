using System.Text.Json;
using System.Text.Json.Serialization;
using Veru.Api.Endpoints;
using Veru.MarketData;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddMarketData(builder.Configuration);

builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
    // Strict keeps OpenAPI from typing every number as "number | string" in the generated TypeScript.
    o.SerializerOptions.NumberHandling = JsonNumberHandling.Strict;
});
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();

app.MapOpenApi(); // /openapi/v1.json, the source for the web app's generated TypeScript types

app.MapGroup("/api").MapMarketDataEndpoints();
app.MapGet("/health", () => TypedResults.Ok(new { status = "ok" })).ExcludeFromDescription();
app.MapGet("/", () => TypedResults.Ok(new
{
    service = "Veru Market Data API",
    ui = "http://localhost:5173 (run `npm run dev` at the repo root)",
    openApi = "/openapi/v1.json",
})).ExcludeFromDescription();

await app.RunAsync();

/// <summary>Exposed for WebApplicationFactory in integration tests.</summary>
public partial class Program;
