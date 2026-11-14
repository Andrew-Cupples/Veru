using Microsoft.AspNetCore.Http.HttpResults;
using Veru.Api.Suggestions;

namespace Veru.Api.Endpoints;

public static class SuggestionEndpoints
{
    public static RouteGroupBuilder MapSuggestionEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/suggestions").WithTags("Suggestions");

        group.MapPost("/", Create)
            .WithName("CreateSuggestion")
            .WithSummary("Saves a suggestion from the in-app suggestion box");

        group.MapGet("/", List)
            .WithName("ListSuggestions")
            .WithSummary("The latest suggestions, newest first");

        return api;
    }

    private static async Task<Results<Created<SuggestionResponse>, ValidationProblem>> Create(
        SuggestionRequest request,
        SuggestionStore store,
        TimeProvider clock,
        CancellationToken cancellationToken)
    {
        var errors = Validate(request);
        if (errors.Count > 0) return TypedResults.ValidationProblem(errors);

        var isOther = request.Feature == SuggestionCatalog.OtherFeature;
        var saved = await store.AddAsync(new Suggestion
        {
            CreatedAt = clock.GetUtcNow(),
            Feature = request.Feature!,
            OtherFeature = isOther ? request.OtherFeature!.Trim() : null,
            Kind = request.Kind!,
            Message = request.Message!.Trim(),
            Page = string.IsNullOrWhiteSpace(request.Page) ? null : request.Page.Trim()[..Math.Min(request.Page.Trim().Length, SuggestionCatalog.MaxPage)],
        }, cancellationToken);

        return TypedResults.Created($"/api/suggestions/{saved.Id}", saved.ToResponse());
    }

    private static async Task<Ok<List<SuggestionResponse>>> List(SuggestionStore store, int? limit, CancellationToken cancellationToken)
    {
        var rows = await store.LatestAsync(Math.Clamp(limit ?? 50, 1, 500), cancellationToken);
        return TypedResults.Ok(rows.Select(s => s.ToResponse()).ToList());
    }

    internal static Dictionary<string, string[]> Validate(SuggestionRequest r)
    {
        var errors = new Dictionary<string, string[]>();
        if (r.Feature is null || !SuggestionCatalog.Features.Contains(r.Feature))
            errors["feature"] = ["Pick the feature this is about."];
        else if (r.Feature == SuggestionCatalog.OtherFeature)
        {
            var other = r.OtherFeature?.Trim() ?? "";
            if (other.Length == 0) errors["otherFeature"] = ["Say which feature this is about."];
            else if (other.Length > SuggestionCatalog.MaxOtherFeature) errors["otherFeature"] = [$"Keep the feature name under {SuggestionCatalog.MaxOtherFeature} characters."];
        }

        if (r.Kind is null || !SuggestionCatalog.Kinds.Contains(r.Kind))
            errors["kind"] = ["Pick what kind of suggestion this is."];

        var message = r.Message?.Trim() ?? "";
        if (message.Length == 0) errors["message"] = ["Write your suggestion."];
        else if (message.Length > SuggestionCatalog.MaxMessage) errors["message"] = [$"Keep it under {SuggestionCatalog.MaxMessage} characters."];

        return errors;
    }

    private static SuggestionResponse ToResponse(this Suggestion s) =>
        new(s.Id, s.CreatedAt, s.Feature, s.OtherFeature, s.Kind, s.Message, s.Page);
}
