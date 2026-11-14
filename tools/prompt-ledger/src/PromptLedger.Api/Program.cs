using System.Text.Json.Serialization;
using PromptLedger.Api;
using PromptLedger.Api.Endpoints;
using PromptLedger.Core.Data;
using PromptLedger.Core.Services;

var builder = WebApplication.CreateBuilder(args);

var options = LedgerOptions.Resolve(builder.Configuration);
builder.Services.AddSingleton(options);
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddDbContext<LedgerDbContext>(o => LedgerDatabase.Configure(o, options.DatabaseFile));
builder.Services.AddScoped<TagService>();
builder.Services.AddScoped<PromptQuery>();
builder.Services.AddScoped(sp => new CaptureService(sp.GetRequiredService<LedgerDbContext>(), sp.GetRequiredService<TimeProvider>()));

builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
    // The web default also accepts numbers sent as strings, which makes OpenAPI type every int as
    // "integer | string". Strict keeps the contract (and the generated TypeScript) honest.
    o.SerializerOptions.NumberHandling = JsonNumberHandling.Strict;
});
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();

var app = builder.Build();

// At build time the OpenAPI generator boots this app only to read its endpoints; don't touch the database then.
var isBuildTimeOpenApi = System.Reflection.Assembly.GetEntryAssembly()?.GetName().Name == "GetDocument.Insider";
if (!isBuildTimeOpenApi)
{
    await using var scope = app.Services.CreateAsyncScope();
    await LedgerDatabase.InitializeAsync(scope.ServiceProvider.GetRequiredService<LedgerDbContext>());
}

app.UseExceptionHandler();
app.UseStatusCodePages();

app.MapOpenApi(); // /openapi/v1.json, the source for the frontend's generated TypeScript types

var api = app.MapGroup("/api");
api.MapPromptEndpoints();
api.MapTagEndpoints();
api.MapLedgerEndpoints();
app.MapGet("/health", () => TypedResults.Ok(new { status = "ok" })).ExcludeFromDescription();

await app.RunAsync();

/// <summary>Exposed for WebApplicationFactory in integration tests.</summary>
public partial class Program;
